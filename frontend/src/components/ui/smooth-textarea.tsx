"use client";

import { useEffect, useRef, type ComponentProps, type Ref } from "react";
import { Textarea } from "./textarea";
import { usePrefersReducedMotion } from "./use-prefers-reduced-motion";
import styles from "./smooth-textarea.module.css";

type SmoothTextareaProps = Omit<ComponentProps<typeof Textarea>, "ref"> & {
  ref?: Ref<HTMLTextAreaElement>;
};

// Skiper106's animated-overlay idea, adapted to a real multiline textarea.
// A DOM mirror measures wrapping, Unicode, padding, tabs and line breaks; it
// never replaces native text, keyboard handling, selection or composition.
export function SmoothTextarea({ ref, ...props }: SmoothTextareaProps) {
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const caretRef = useRef<HTMLSpanElement>(null);
  const reduced = usePrefersReducedMotion();

  useEffect(() => {
    const input = inputRef.current;
    const caret = caretRef.current;
    if (!input || !caret) return;
    const desktop = window.matchMedia("(min-width: 641px) and (pointer: fine) and (hover: hover)");
    const originalCaretColor = input.style.caretColor;
    const mirror = document.createElement("div");
    mirror.setAttribute("aria-hidden", "true");
    mirror.setAttribute("data-smooth-caret-mirror", "");
    // Fixed and offscreen: a hidden mirror must never enlarge page scroll
    // bounds when a desktop textarea is resized down to a mobile viewport.
    Object.assign(mirror.style, { position: "fixed", visibility: "hidden", pointerEvents: "none", top: "0", left: "-10000px", height: "auto", whiteSpace: "pre-wrap", overflowWrap: "break-word" });
    document.body.append(mirror);
    let composing = false;
    let dragging = false;
    let disposed = false;

    function nativeCaret() {
      input!.style.caretColor = originalCaretColor;
      caret!.hidden = true;
      caret!.removeAttribute("data-positioned");
    }

    function sync() {
      if (disposed) return;
      if (reduced || !desktop.matches || document.hidden || document.activeElement !== input
        || input!.disabled || input!.readOnly || composing || dragging
        || input!.selectionStart !== input!.selectionEnd || input!.clientWidth === 0
        // Native bidi positioning is more reliable than a mirrored overlay.
        || /[\u0590-\u08ff\ufb1d-\ufdff\ufe70-\ufeff]/u.test(input!.value)) {
        nativeCaret(); return;
      }
      const computed = window.getComputedStyle(input!);
      if (computed.direction && computed.direction !== "ltr") { nativeCaret(); return; }
      for (const property of ["boxSizing", "fontFamily", "fontSize", "fontWeight", "fontStyle", "fontVariant", "fontStretch", "lineHeight", "letterSpacing", "wordSpacing", "textTransform", "textIndent", "textAlign", "tabSize", "paddingTop", "paddingRight", "paddingBottom", "paddingLeft", "borderTopWidth", "borderRightWidth", "borderBottomWidth", "borderLeftWidth", "borderStyle", "wordBreak"] as const) {
        mirror.style[property] = computed[property];
      }
      mirror.style.width = `${input!.offsetWidth}px`;
      const marker = document.createElement("span");
      marker.textContent = input!.value.slice(input!.selectionStart) || "\u200b";
      mirror.replaceChildren(document.createTextNode(input!.value.slice(0, input!.selectionStart)), marker);
      const fontSize = Number.parseFloat(computed.fontSize) || 16;
      const height = fontSize * 1.25;
      const x = marker.offsetLeft - input!.scrollLeft;
      const y = marker.offsetTop - input!.scrollTop;
      if (x < 0 || y < 0 || x > input!.clientWidth - 2 || y + height > input!.clientHeight) {
        nativeCaret(); return;
      }
      // Place the first caret without a flight across the input. Subsequent
      // positions glide via CSS; there is no continuous JS animation loop.
      caret!.style.transition = caret!.hidden ? "none" : "";
      caret!.style.transform = `translate3d(${x}px, ${y}px, 0)`;
      caret!.style.height = `${height}px`;
      caret!.hidden = false;
      caret!.setAttribute("data-positioned", "true");
      input!.style.caretColor = "transparent";
    }

    const startComposition = () => { composing = true; sync(); };
    const endComposition = () => { composing = false; sync(); };
    const startDrag = () => { dragging = true; sync(); };
    const endDrag = () => { dragging = false; sync(); };
    const events = ["input", "select", "keyup", "click", "focus", "blur", "scroll"] as const;
    events.forEach((event) => input.addEventListener(event, sync));
    input.addEventListener("compositionstart", startComposition);
    input.addEventListener("compositionend", endComposition);
    input.addEventListener("pointerdown", startDrag);
    document.addEventListener("pointerup", endDrag);
    document.addEventListener("selectionchange", sync);
    document.addEventListener("visibilitychange", sync);
    window.addEventListener("resize", sync);
    desktop.addEventListener("change", sync);
    document.fonts?.addEventListener("loadingdone", sync);
    const observer = new ResizeObserver(sync);
    observer.observe(input);
    sync();

    return () => {
      disposed = true;
      nativeCaret();
      observer.disconnect();
      events.forEach((event) => input.removeEventListener(event, sync));
      input.removeEventListener("compositionstart", startComposition);
      input.removeEventListener("compositionend", endComposition);
      input.removeEventListener("pointerdown", startDrag);
      document.removeEventListener("pointerup", endDrag);
      document.removeEventListener("selectionchange", sync);
      document.removeEventListener("visibilitychange", sync);
      window.removeEventListener("resize", sync);
      desktop.removeEventListener("change", sync);
      document.fonts?.removeEventListener("loadingdone", sync);
      mirror.remove();
    };
  }, [reduced, props.disabled, props.readOnly]);

  return (
    <div className={styles.surface}>
      <Textarea {...props} ref={(input) => {
        inputRef.current = input;
        if (typeof ref === "function") ref(input);
        else if (ref) ref.current = input;
      }} />
      <span className={styles.clip} aria-hidden="true">
        <span ref={caretRef} className={styles.caret} hidden data-smooth-caret><span /></span>
      </span>
    </div>
  );
}
