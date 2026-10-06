import { useId } from "react";
import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import type { RespondResponse } from "@/lib/types";
import styles from "./response-details.module.css";

export function ResponseDetails({ response }: { response: RespondResponse }) {
  const headingId = useId();
  // The API validator checks ascending backend ranks. Preserve that order;
  // do not rerank by style_score or construct browser-side explanations.
  const alternatives = response.candidates.filter((candidate) => candidate.rank !== response.best.rank);
  return (
    <Collapsible className={styles.details}>
      <CollapsibleTrigger asChild>
        <Button type="button" variant="ghost" className={styles.trigger} aria-label="Why this response">
          <span>Why this response</span>
          {alternatives.length ? <span className={styles.count} aria-hidden="true">{alternatives.length} alternatives</span> : null}
          <ChevronDown size={14} className={styles.chevron} aria-hidden="true" />
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className={styles.content} role="region" aria-labelledby={headingId}>
        <h2 id={headingId} className={styles.heading}>Why this response</h2>
        {response.best.reasons.length ? (
          <ul className={styles.reasons} aria-label="Backend-provided reasons">
            {response.best.reasons.map((reason, index) => <li key={index}>{reason}</li>)}
          </ul>
        ) : <p className={styles.note}>The backend didn’t provide an explanation for this reply.</p>}
        <p className={styles.note}>Backend style signals—not a personal style profile yet.</p>
        <h3 className={styles.heading}>Other ways to reply</h3>
        {alternatives.length ? (
          <ol className={styles.alternatives} aria-label="Ranked alternatives" start={2}>
            {alternatives.map((candidate) => (
              <li key={candidate.rank} className={styles.alternative} value={candidate.rank}>
                <span className={styles.rank}>Rank {candidate.rank}</span>
                <p>{candidate.candidate}</p>
              </li>
            ))}
          </ol>
        ) : <p className={styles.note}>No other replies were returned.</p>}
      </CollapsibleContent>
    </Collapsible>
  );
}
