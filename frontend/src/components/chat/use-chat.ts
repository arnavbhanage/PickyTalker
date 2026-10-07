"use client";

import { useEffect, useRef, useState } from "react";
import { pickyTalkerApi, PickyTalkerApiError } from "@/lib/api";
import type { RespondResponse } from "@/lib/types";

export type ChatTurn = {
  id: number;
  incoming: string;
  status: "pending" | "complete" | "failed";
  response?: RespondResponse;
  error?: string;
  sampleCount?: number;
};

export function chatErrorMessage(error: unknown): string {
  if (!(error instanceof PickyTalkerApiError)) return "Something went wrong. Your draft is safe; please try again.";
  switch (error.kind) {
    case "backend_unavailable": return "Can't reach PickyTalker right now. Check that the backend is running and reachable, then try again.";
    case "timeout": return "This request took too long. Your draft is safe. The backend may still be working; wait a moment before retrying.";
    case "provider_unavailable": return "The AI provider couldn't complete this request. Your draft is safe; try again in a moment.";
    case "malformed_generation":
    case "no_candidates": return "The backend didn't return a usable reply. Your draft is safe; please try again.";
    case "unauthorized": return "PickyTalker isn't accepting requests right now. Your draft is safe; the backend's authorization needs attention.";
    case "validation": return "The backend couldn't accept this message. Review your draft and try again.";
    case "cancelled": return "The request was cancelled. Your draft is safe.";
    default: return "PickyTalker couldn't complete the request. Your draft is safe; please try again.";
  }
}

export function useChat(writingSamples: readonly string[] = []) {
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const turnsRef = useRef<ChatTurn[]>([]);
  const active = useRef<{ id: number; controller: AbortController } | null>(null);
  const sequence = useRef(0);

  useEffect(() => () => { active.current?.controller.abort(); active.current = null; }, []);

  function update(next: ChatTurn[]) {
    turnsRef.current = next;
    setTurns(next);
  }

  async function submit(incoming: string) {
    // Synchronous lock also covers retries before React disables the composer.
    if (active.current) throw new PickyTalkerApiError("unexpected", "A request is already running.");
    const last = turnsRef.current.at(-1);
    const id = last?.status === "failed" && last.incoming === incoming ? last.id : ++sequence.current;
    const controller = new AbortController();
    active.current = { id, controller };
    const history = [...writingSamples];
    const turn: ChatTurn = { id, incoming, status: "pending", sampleCount: history.length };
    update(id === last?.id ? [...turnsRef.current.slice(0, -1), turn] : [...turnsRef.current, turn]);
    try {
      // Snapshot only explicitly supplied user-authored samples. Received
      // messages, AI replies and ratings are never used as writing evidence.
      const response = await pickyTalkerApi.respond({ history, incoming }, { signal: controller.signal });
      if (active.current?.controller !== controller || controller.signal.aborted) return;
      update(turnsRef.current.map((item) => item.id === id ? { ...turn, status: "complete", response } : item));
    } catch (error) {
      if (active.current?.controller === controller && !controller.signal.aborted) {
        update(turnsRef.current.map((item) => item.id === id ? { ...turn, status: "failed", error: chatErrorMessage(error) } : item));
      }
      throw error;
    } finally {
      if (active.current?.controller === controller) active.current = null;
    }
  }

  return { turns, submit, busy: turns.some((turn) => turn.status === "pending") };
}
