import { useEffect, useState } from "react";
import { LatticeLoader } from "@/components/ui/lattice-loader";
import styles from "./chat-workspace.module.css";

export function GenerationStatus() {
  const [longWait, setLongWait] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setLongWait(true), 60_000);
    return () => clearTimeout(timer);
  }, []);
  return (
    <div className={styles.generation} role="status" aria-live="polite" aria-atomic="true">
      <LatticeLoader />
      <div>
        <p className={styles.generationTitle}>Finding the right words…</p>
        <p className={styles.generationDetail}>{longWait
          ? "Still waiting on the AI provider. Some replies take a few minutes."
          : "Generating and ranking replies. This can take a little while."}</p>
      </div>
    </div>
  );
}
