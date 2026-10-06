"use client";

import { useEffect, useRef, useState } from "react";
import { Feather, LockKeyhole } from "lucide-react";
import { DottedGlowBackground } from "@/components/ui/dotted-glow-background";
import { MessageComposer } from "./message-composer";
import styles from "./chat-workspace.module.css";

export function ChatWorkspace() {
  // Phase 3: real composer behavior, local messages only. No API or AI output.
  const [messages, setMessages] = useState<string[]>([]);
  const conversationRef = useRef<HTMLDivElement>(null);
  const isEmpty = messages.length === 0;

  function addLocalMessage(message: string) {
    setMessages((current) => [...current, message]);
  }

  useEffect(() => {
    const conversation = conversationRef.current;
    if (conversation) conversation.scrollTop = conversation.scrollHeight;
  }, [messages.length]);

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
            <div ref={conversationRef} className={styles.conversation} role="log" aria-label="Incoming messages" aria-live="polite" aria-relevant="additions" tabIndex={0}>
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

        <MessageComposer onSubmit={addLocalMessage} />

        {isEmpty ? <p className={styles.quietNote}><LockKeyhole size={12} aria-hidden="true" /> A little space to find the right words.</p> : null}
      </div>
      <p className={styles.footer}>Thoughtfully chosen. Naturally yours.</p>
    </section>
  );
}
