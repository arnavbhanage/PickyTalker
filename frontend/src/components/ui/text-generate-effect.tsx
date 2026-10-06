import type { CSSProperties } from "react";
import styles from "./text-generate-effect.module.css";
import { usePrefersReducedMotion } from "./use-prefers-reduced-motion";

// Aceternity's word-by-word reveal, adapted to CSS with an exact whitespace
// split and a bounded delay. This is a presentation effect, not streaming.
export function TextGenerateEffect({ text }: { text: string }) {
  const reduced = usePrefersReducedMotion();
  const parts = text.split(/(\s+)/);
  const wordCount = parts.filter((part) => part && !/^\s+$/.test(part)).length;
  let word = 0;
  return (
    <p className={styles.text} data-selected-response>
      <span className="sr-only">{text}</span>
      <span aria-hidden="true" data-response-visual>
        {reduced ? text : parts.map((part, index) => /^\s*$/.test(part) ? part : (
          <span key={index} className={styles.word}
            style={{ "--reveal-delay": `${word++ * Math.min(45, 900 / Math.max(1, wordCount - 1))}ms` } as CSSProperties}>{part}</span>
        ))}
      </span>
    </p>
  );
}
