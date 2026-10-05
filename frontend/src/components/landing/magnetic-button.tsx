"use client";

import { useRef, type PointerEvent, type ReactNode } from "react";

type MagneticButtonProps = {
  label: string;
  href: string;
  children: ReactNode;
};

export function MagneticButton({
  label,
  href,
  children,
}: MagneticButtonProps) {
  const controlRef = useRef<HTMLElement>(null);

  const setControlRef = (node: HTMLElement | null) => {
    controlRef.current = node;
  };

  function handlePointerMove(event: PointerEvent<HTMLSpanElement>) {
    if (!href || event.pointerType !== "mouse" || !controlRef.current) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      resetPosition();
      return;
    }

    const bounds = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - bounds.left - bounds.width / 2;
    const y = event.clientY - bounds.top - bounds.height / 2;
    controlRef.current.style.transform = `translate(${x * 0.08}px, ${y * 0.08}px)`;
  }

  function resetPosition() {
    if (controlRef.current) controlRef.current.style.transform = "";
  }

  return (
    <span
      className="magnetic-wrap"
      onPointerMove={handlePointerMove}
      onPointerLeave={resetPosition}
    >
      {href ? (
        <a
          ref={setControlRef}
          className="social-control"
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={label}
        >
          {children}
        </a>
      ) : (
        <button
          ref={setControlRef}
          className="social-control"
          type="button"
          disabled
          aria-label={`${label} URL not configured`}
          title="Add this profile URL in src/lib/links.ts"
        >
          {children}
        </button>
      )}
    </span>
  );
}
