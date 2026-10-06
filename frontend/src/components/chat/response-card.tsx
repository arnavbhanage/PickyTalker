import { useEffect, useRef, useState } from "react";
import { Check, Copy, Feather } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TextGenerateEffect } from "@/components/ui/text-generate-effect";
import type { RespondResponse } from "@/lib/types";
import { ResponseDetails } from "./response-details";
import { ResponseRating } from "./response-rating";
import styles from "./chat-workspace.module.css";

export function ResponseCard({ response }: { response: RespondResponse }) {
  const text = response.best.candidate;
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState(false);
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const copying = useRef(false);
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; if (resetTimer.current) clearTimeout(resetTimer.current); };
  }, []);

  async function copy() {
    if (copying.current) return;
    copying.current = true;
    try {
      // No trimming, formatting, metadata, labels, or backend scores.
      await navigator.clipboard.writeText(text);
      if (!mounted.current) return;
      setCopied(true);
      setCopyError(false);
      if (resetTimer.current) clearTimeout(resetTimer.current);
      resetTimer.current = setTimeout(() => { setCopied(false); resetTimer.current = null; }, 2000);
    } catch {
      if (mounted.current) { setCopied(false); setCopyError(true); }
    } finally { copying.current = false; }
  }

  return (
    <article className={styles.response} aria-label="Selected reply">
      <div className={styles.responseHeader}>
        <span><Feather size={15} strokeWidth={1.5} aria-hidden="true" /> Selected reply</span>
        <Button type="button" variant="ghost" size="sm" className={styles.copy} onClick={() => { void copy(); }}
          aria-label={copied ? "Reply copied" : "Copy reply"}>
          <span className={styles.copyIcon} key={copied ? "check" : "copy"} aria-hidden="true">{copied ? <Check size={15} /> : <Copy size={15} />}</span>
          {copied ? "Copied" : "Copy"}
        </Button>
      </div>
      <TextGenerateEffect text={text} />
      <span className="sr-only" role="status" aria-label="Copy feedback">{copied ? "Reply copied to clipboard." : ""}</span>
      {copyError ? <p className={styles.copyError} role="alert">Clipboard access was blocked. Select the reply text to copy it manually.</p> : null}
      <ResponseDetails response={response} />
      <ResponseRating />
    </article>
  );
}
