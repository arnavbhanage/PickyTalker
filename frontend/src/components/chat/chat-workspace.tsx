"use client";

import { useEffect, useRef, useState } from "react";
import { Feather } from "lucide-react";
import { DottedGlowBackground } from "@/components/ui/dotted-glow-background";
import { Button } from "@/components/ui/button";
import { MessageComposer, type MessageComposerHandle } from "./message-composer";
import { GenerationStatus } from "./generation-status";
import { ResponseCard } from "./response-card";
import { useChat } from "./use-chat";
import { WritingProfileEditor } from "./writing-profile-editor";
import { MIN_STYLE_SAMPLES, type WritingProfile } from "@/lib/writing-profile";
import styles from "./chat-workspace.module.css";

export function ChatWorkspace({ initialWritingProfile = { samples: [], revision: null }, writingProfileUnavailable = false }: {
  initialWritingProfile?: WritingProfile;
  writingProfileUnavailable?: boolean;
}) {
  const [writingProfile, setWritingProfile] = useState(initialWritingProfile);
  const [profileUnavailable, setProfileUnavailable] = useState(writingProfileUnavailable);
  const { turns, submit, busy } = useChat(writingProfile.samples);
  const composerRef = useRef<MessageComposerHandle>(null);
  const conversationRef = useRef<HTMLDivElement>(null);
  const isEmpty = turns.length === 0;

  useEffect(() => {
    const conversation = conversationRef.current;
    if (conversation) conversation.scrollTop = conversation.scrollHeight;
  }, [turns]);

  return (
    <section className={styles.workspace} aria-label="PickyTalker conversation workspace">
      <div className={`${styles.frame} ${isEmpty ? styles.empty : styles.active}`} data-chat-state={isEmpty ? "empty" : "active"}>
        {isEmpty ? <DottedGlowBackground className={styles.dots} /> : null}

        {isEmpty ? (
          <header className={styles.intro}>
            <span className={styles.emblem} aria-hidden="true"><Feather size={23} strokeWidth={1.5} /></span>
            <p className={styles.eyebrow}>YOUR WORDS. YOUR WAY.</p>
            <h1>AI responses that<br /> sound like you.</h1>
          </header>
        ) : (
          <>
            <header className={styles.conversationHeader}>
              <Feather size={18} strokeWidth={1.5} aria-hidden="true" />
              <h1>Your conversation</h1>
              <span>Just this session</span>
            </header>
            <div ref={conversationRef} className={styles.conversation} role="log" aria-label="Conversation" aria-live="polite" aria-relevant="additions text" tabIndex={0}>
              <ol className={styles.messages}>
                {turns.map((turn, index) => (
                  <li className={styles.turn} key={turn.id}>
                    <div className={styles.message}>
                      <span className={styles.messageLabel}>Message to reply to</span>
                      <p>{turn.incoming}</p>
                    </div>
                    {turn.status === "pending" ? <GenerationStatus /> : null}
                    {turn.status === "failed" ? (
                      <div className={styles.failure}>
                        <p role="alert">{turn.error}</p>
                        {index === turns.length - 1 ? <Button type="button" variant="outline" size="sm" disabled={busy}
                          onClick={() => composerRef.current?.retry(turn.incoming)}>Retry generation</Button> : null}
                      </div>
                    ) : null}
                    {turn.status === "complete" && turn.response ? <ResponseCard response={turn.response} sampleCount={turn.sampleCount} /> : null}
                  </li>
                ))}
              </ol>
            </div>
          </>
        )}

        <MessageComposer ref={composerRef} onSubmit={submit} busy={busy} submissionErrorHandled />
      </div>
      <div className={styles.voiceControls}>
        <WritingProfileEditor profile={writingProfile} onSaved={(profile) => { setWritingProfile(profile); setProfileUnavailable(false); }} busy={busy} />
        <p className={styles.footer} role="status">{profileUnavailable && !writingProfile.samples.length
          ? "Writing samples couldn’t be loaded. Open Your voice to retry."
          : !writingProfile.samples.length ? "Add your own writing samples to personalize replies."
            : writingProfile.samples.length < MIN_STYLE_SAMPLES ? `${writingProfile.samples.length} samples saved. Add at least 3 to start matching your voice.`
              : `Using ${writingProfile.samples.length} of your writing samples. Style matching isn’t guaranteed.`}</p>
      </div>
    </section>
  );
}
