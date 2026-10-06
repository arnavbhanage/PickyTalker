"use client";

import { useRef, useState, type FormEvent } from "react";
import { ArrowUp, Feather, LockKeyhole } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DottedGlowBackground } from "@/components/ui/dotted-glow-background";
import { Textarea } from "@/components/ui/textarea";
import styles from "./chat-workspace.module.css";

export function ChatWorkspace() {
  // Phase 2: local layout preview only. No API, AI output, or persistence.
  const [messages, setMessages] = useState<string[]>([]);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const isEmpty = messages.length === 0;

  function addLocalMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const message = inputRef.current?.value.trim();
    if (!message) return;
    setMessages((current) => [...current, message]);
    event.currentTarget.reset();
    inputRef.current?.focus();
  }

  return (
    <section className={styles.workspace} aria-label="PickyTalker conversation workspace">
      <div className={`${styles.frame} ${isEmpty ? styles.empty : styles.active}`} data-chat-state={isEmpty ? "empty" : "active"}>
        {isEmpty ? <DottedGlowBackground className={styles.dots} /> : null}

        {isEmpty ? (
          <header className={styles.intro}>
            <span className={styles.emblem} aria-hidden="true"><Feather size={23} strokeWidth={1.5} /></span>
            <p className={styles.eyebrow}>YOUR WORDS. YOUR WAY.</p>
            <h1>AI responses that<br /> sound like you.</h1>
            <p className={styles.subtitle}>Paste a message you want to reply to.</p>
          </header>
        ) : (
          <>
            <header className={styles.conversationHeader}>
              <Feather size={18} strokeWidth={1.5} aria-hidden="true" />
              <h1>Your conversation</h1>
              <span>Just this session</span>
            </header>
            <div className={styles.conversation} role="log" aria-label="Incoming messages" aria-live="polite" aria-relevant="additions" tabIndex={0}>
              <ol className={styles.messages}>
                {messages.map((message, index) => (
                  <li className={styles.message} key={index}>
                    <span className={styles.messageLabel}>Message to reply to</span>
                    <p>{message}</p>
                  </li>
                ))}
              </ol>
            </div>
          </>
        )}

        <div className={styles.composerArea}>
          <form className={styles.composer} onSubmit={addLocalMessage}>
            <label className="sr-only" htmlFor="incoming-message">Message you want to reply to</label>
            <Textarea ref={inputRef} id="incoming-message" name="incoming" className={styles.input} placeholder="Paste their message here…" rows={3} maxLength={2000} required aria-describedby="composer-note" />
            <div className={styles.composerToolbar}>
              <span>Make room for your voice.</span>
              <Button type="submit" size="icon" className={styles.submit} aria-label="Add message to conversation">
                <ArrowUp size={18} aria-hidden="true" />
              </Button>
            </div>
          </form>
          <p id="composer-note" className={styles.composerNote}>Messages stay in this tab. Reply generation comes next.</p>
        </div>

        {isEmpty ? <p className={styles.quietNote}><LockKeyhole size={12} aria-hidden="true" /> A little space to find the right words.</p> : null}
      </div>
      <p className={styles.footer}>Thoughtfully chosen. Naturally yours.</p>
    </section>
  );
}
