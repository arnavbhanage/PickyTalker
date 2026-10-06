import { useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { PeekRating } from "@/components/ui/peek-rating";
import styles from "./response-rating.module.css";

export function ResponseRating() {
  // Deliberately memory-only. There is no feedback endpoint or persistence claim.
  const [value, setValue] = useState(0);
  const id = useId();
  return (
    <section className={styles.rating} aria-labelledby={`${id}-label`}>
      <h3 id={`${id}-label`} className={styles.heading}>Was this response useful?</h3>
      <div className={styles.controls}>
        <PeekRating value={value} onChange={setValue} labelledBy={`${id}-label`} describedBy={`${id}-note`} />
        <Button type="button" variant="ghost" size="sm" className={styles.clear} disabled={!value} onClick={() => setValue(0)} aria-label="Clear response rating">Clear</Button>
      </div>
      <p id={`${id}-note`} className={styles.note}>Only kept in this session—not saved or sent.</p>
      <span className="sr-only" role="status" aria-label="Rating feedback">{value ? `Rated ${value} of 5 for this session.` : "No response rating selected."}</span>
    </section>
  );
}
