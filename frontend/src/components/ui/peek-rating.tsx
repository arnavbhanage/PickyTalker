"use client";

import { useState } from "react";
import { Star } from "lucide-react";
import { RadioGroup } from "radix-ui";
import { Button } from "@/components/ui/button";
import styles from "./peek-rating.module.css";

const labels = ["Not useful", "Slightly useful", "Somewhat useful", "Useful", "Very useful"];

// React Bits Peek Rating adaptation: preview lift/tip, with shadcn buttons and
// Radix radio semantics instead of pointer capture or imperative animation.
export function PeekRating({ value, onChange, labelledBy, describedBy }: {
  value: number;
  onChange: (value: number) => void;
  labelledBy: string;
  describedBy: string;
}) {
  const [preview, setPreview] = useState<number | null>(null);
  const shown = preview ?? value;

  return (
    <RadioGroup.Root value={value ? String(value) : ""} onValueChange={(next) => onChange(Number(next))}
      orientation="horizontal" aria-labelledby={labelledBy} aria-describedby={describedBy}
      className={styles.row} onPointerLeave={() => setPreview(null)}
      onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setPreview(null); }}>
      {labels.map((label, index) => {
        const rating = index + 1;
        return (
          <RadioGroup.Item key={rating} value={String(rating)} asChild>
            <Button type="button" variant="ghost" className={styles.star}
              aria-label={`${rating} of 5, ${label}`} data-lit={rating <= shown}
              data-peeking={preview !== null && rating <= preview}
              onPointerEnter={(event) => { if (event.pointerType === "mouse") setPreview(rating); }}
              onFocus={() => setPreview(rating)} onClick={() => setPreview(null)}
              onKeyDown={(event) => {
                if (event.key === "Enter") { event.preventDefault(); onChange(rating); setPreview(null); }
              }}>
              <span className={styles.glyph} aria-hidden="true"><Star className="size-[22px]" size={22} strokeWidth={1.6} /></span>
              {preview === rating ? <span className={styles.tip} aria-hidden="true">{label}</span> : null}
            </Button>
          </RadioGroup.Item>
        );
      })}
    </RadioGroup.Root>
  );
}
