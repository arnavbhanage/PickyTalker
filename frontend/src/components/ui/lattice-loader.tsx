import styles from "./lattice-loader.module.css";
import { usePrefersReducedMotion } from "./use-prefers-reduced-motion";

// Reduced subset of React Bits Lattice Loader's 3x3 orbit pattern. Only the
// lattice animates; status text is stable and announced by its parent.
const ORBIT = [0, 1, 2, 7, null, 3, 6, 5, 4];

export function LatticeLoader() {
  const reduced = usePrefersReducedMotion();
  return (
    <span className={styles.grid} aria-hidden="true" data-lattice-loader data-static={reduced || undefined}>
      {ORBIT.map((step, index) => (
        <span key={index} className={styles.cell} data-hole={step === null || undefined}
          style={step === null ? undefined : { animationDelay: `${step * 108}ms` }} />
      ))}
    </span>
  );
}
