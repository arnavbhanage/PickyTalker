"use client";

import { useEffect, useRef } from "react";

type DottedGlowBackgroundProps = {
  className?: string;
  gap?: number;
  radius?: number;
  opacity?: number;
  color?: string;
  glowColor?: string;
};

// Adapted from Aceternity's canvas grid / triangular glow treatment:
// https://ui.aceternity.com/registry/dotted-glow-background.json
// Light-theme subset, with static reduced motion and visibility-aware cleanup.
export function DottedGlowBackground({
  className,
  gap = 24,
  radius = 1,
  opacity = 0.36,
  color = "#a7b0c2",
  glowColor = "#899dca",
}: DottedGlowBackgroundProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;

    const motionPreference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const spacing = Math.max(12, gap);
    let width = 0;
    let height = 0;
    let frame: number | null = null;
    let disposed = false;
    let dots: { x: number; y: number; phase: number; speed: number }[] = [];

    const draw = (now: number) => {
      context.clearRect(0, 0, width, height);
      context.fillStyle = color;
      for (const dot of dots) {
        const wave = ((now / 1000) * dot.speed + dot.phase) % 2;
        const brightness = motionPreference.matches ? 0.42 : 0.25 + 0.55 * (wave < 1 ? wave : 2 - wave);
        context.globalAlpha = brightness * opacity;
        context.shadowColor = motionPreference.matches ? "transparent" : glowColor;
        context.shadowBlur = !motionPreference.matches && brightness > 0.6 ? 4 : 0;
        context.beginPath();
        context.arc(dot.x, dot.y, Math.max(0.5, radius), 0, Math.PI * 2);
        context.fill();
      }
    };

    const animate = (now: number) => {
      frame = null;
      if (disposed || document.hidden || motionPreference.matches) return;
      draw(now);
      frame = requestAnimationFrame(animate);
    };

    const syncAnimation = () => {
      if (frame !== null) cancelAnimationFrame(frame);
      frame = null;
      if (disposed || document.hidden) return;
      draw(performance.now());
      if (!motionPreference.matches) frame = requestAnimationFrame(animate);
    };

    const resize = () => {
      const bounds = container.getBoundingClientRect();
      width = bounds.width;
      height = bounds.height;
      const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.floor(width * pixelRatio));
      canvas.height = Math.max(1, Math.floor(height * pixelRatio));
      context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
      dots = [];
      for (let row = 0; row <= Math.ceil(height / spacing); row++) {
        for (let column = 0; column <= Math.ceil(width / spacing); column++) {
          const seed = (row * 37 + column * 17) % 101;
          dots.push({ x: column * spacing + (row % 2 ? spacing / 2 : 0), y: row * spacing, phase: seed / 50, speed: 0.2 + seed / 300 });
        }
      }
      syncAnimation();
    };

    const observer = new ResizeObserver(resize);
    observer.observe(container);
    resize();
    motionPreference.addEventListener("change", syncAnimation);
    document.addEventListener("visibilitychange", syncAnimation);

    return () => {
      disposed = true;
      if (frame !== null) cancelAnimationFrame(frame);
      observer.disconnect();
      motionPreference.removeEventListener("change", syncAnimation);
      document.removeEventListener("visibilitychange", syncAnimation);
    };
  }, [gap, radius, opacity, color, glowColor]);

  return (
    <div ref={containerRef} className={className} aria-hidden="true" data-dotted-glow="" style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
      <canvas ref={canvasRef} style={{ display: "block", width: "100%", height: "100%" }} />
    </div>
  );
}
