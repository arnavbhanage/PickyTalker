"use client";

import { useEffect, useId, useImperativeHandle, useRef, useState, type KeyboardEvent, type Ref } from "react";
import { ArrowUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SmoothTextarea } from "@/components/ui/smooth-textarea";
import styles from "./message-composer.module.css";

export const MAX_MESSAGE_CHARACTERS = 2000;

type MessageComposerProps = {
  onSubmit: (message: string) => void | Promise<void>;
  busy?: boolean;
  ref?: Ref<MessageComposerHandle>;
  submissionErrorHandled?: boolean;
};

export type MessageComposerHandle = { retry: (message: string) => void };

// Native multiline input semantics with a Skiper106-style gliding caret.
export function MessageComposer({ onSubmit, busy = false, ref, submissionErrorHandled = false }: MessageComposerProps) {
  const id = useId();
  const inputId = `incoming-${id}`;
  const helpId = `composer-help-${id}`;
  const errorId = `composer-error-${id}`;
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [focusEpoch, setFocusEpoch] = useState(0);
  const draftRef = useRef("");
  const submittingRef = useRef(false);
  const composingRef = useRef(false);
  const restoreFocusRef = useRef(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const disabled = busy || submitting;
  // Match Pydantic's Unicode character count, not UTF-16 code units.
  const characterCount = Array.from(draft).length;

  useEffect(() => {
    const input = inputRef.current;
    if (!input) return;
    input.style.height = "auto";
    input.style.height = `${Math.max(72, Math.min(input.scrollHeight, 180))}px`;
    input.style.overflowY = input.scrollHeight > 180 ? "auto" : "hidden";
  }, [draft]);

  async function submitDraft(retryMessage?: string) {
    // Ref closes the gap before React commits the disabled state.
    if (busy || submittingRef.current || composingRef.current) return;
    const originalDraft = draftRef.current;
    const message = retryMessage ?? originalDraft.trim();
    if (!message) {
      setError("Paste a message before sending.");
      inputRef.current?.focus();
      return;
    }
    if (Array.from(retryMessage ?? originalDraft).length > MAX_MESSAGE_CHARACTERS) {
      setError(`Keep your message to ${MAX_MESSAGE_CHARACTERS.toLocaleString("en-US")} characters or fewer.`);
      inputRef.current?.focus();
      return;
    }

    submittingRef.current = true;
    setSubmitting(true);
    setError(null);
    try {
      await onSubmit(message);
      // Never erase a newer draft if the parent changes while awaiting success.
      if (draftRef.current === originalDraft && originalDraft.trim() === message) {
        draftRef.current = "";
        setDraft("");
      }
    } catch {
      if (!submissionErrorHandled) setError("Couldn't add your message. Your draft is still here—try again.");
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
      // An immediate failure may batch both disabled transitions into one
      // render. Still restore focus after every completed submission/retry.
      setFocusEpoch((epoch) => epoch + 1);
    }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== "Enter" || event.shiftKey || event.altKey || event.ctrlKey || event.metaKey) return;
    // IME confirmation must never send a partially composed message.
    if (composingRef.current || event.nativeEvent.isComposing || event.keyCode === 229) return;
    event.preventDefault();
    if (!event.repeat && !disabled) requestSubmission();
  }

  // Wait until the disabled attribute has been removed before restoring focus.
  useEffect(() => {
    if (!disabled && restoreFocusRef.current) {
      restoreFocusRef.current = false;
      inputRef.current?.focus();
    }
  }, [disabled, draft, error, focusEpoch]);

  function requestSubmission(retryMessage?: string) {
    if (busy || submittingRef.current || composingRef.current) return;
    restoreFocusRef.current = true;
    void submitDraft(retryMessage);
  }

  useImperativeHandle(ref, () => ({ retry: requestSubmission }));

  return (
    <div className={styles.area}>
      <form className={styles.composer} noValidate aria-busy={disabled} onSubmit={(event) => {
        event.preventDefault();
        requestSubmission();
      }}>
        <label className="sr-only" htmlFor={inputId}>Message you want to reply to</label>
        <SmoothTextarea
          ref={inputRef}
          id={inputId}
          name="incoming"
          className={styles.input}
          placeholder="Paste their message here…"
          rows={3}
          value={draft}
          disabled={disabled}
          required
          aria-invalid={Boolean(error)}
          aria-describedby={`${helpId}${error ? ` ${errorId}` : ""}`}
          aria-keyshortcuts="Enter Shift+Enter"
          onChange={(event) => {
            draftRef.current = event.target.value;
            setDraft(event.target.value);
            setError(null);
          }}
          onKeyDown={handleKeyDown}
          onCompositionStart={() => { composingRef.current = true; }}
          onCompositionEnd={() => { composingRef.current = false; }}
        />
        <div className={styles.toolbar}>
          <span className={styles.shortcuts}><kbd>Enter</kbd> to send · <kbd>Shift + Enter</kbd> for a new line</span>
          <div className={styles.actions}>
            {characterCount >= 1600 ? <span className={styles.count} data-over-limit={characterCount > MAX_MESSAGE_CHARACTERS} aria-label={`${characterCount} of ${MAX_MESSAGE_CHARACTERS} characters`}>{characterCount.toLocaleString("en-US")} / 2,000</span> : null}
            <Button type="submit" size="icon" className={styles.submit} disabled={disabled} aria-label="Generate reply">
              <ArrowUp size={18} aria-hidden="true" />
            </Button>
          </div>
        </div>
      </form>
      {error ? <p className={styles.error} id={errorId} role="alert">{error}</p> : null}
      <p id={helpId} className={styles.note}>Sent to the AI provider. Review replies before sending.</p>
    </div>
  );
}
