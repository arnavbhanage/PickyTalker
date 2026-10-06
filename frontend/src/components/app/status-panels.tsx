"use client";

import { AlertCircle, Inbox, LoaderCircle, RotateCcw } from "lucide-react";
import type { ReactNode } from "react";
import type { ApiErrorKind } from "@/lib/api";

const ERROR_COPY: Record<
  ApiErrorKind,
  { title: string; message: string; retryable: boolean }
> = {
  backend_unavailable: {
    title: "Backend unavailable",
    message: "PickyTalker cannot reach the local service right now.",
    retryable: true,
  },
  timeout: {
    title: "Still waiting",
    message: "Response generation is taking longer than expected.",
    retryable: true,
  },
  provider_unavailable: {
    title: "Generation unavailable",
    message: "AI response generation is temporarily unavailable.",
    retryable: true,
  },
  malformed_generation: {
    title: "Invalid response",
    message: "We couldn't create a valid response this time.",
    retryable: true,
  },
  validation: {
    title: "Check your input",
    message: "Some information is missing or does not meet the request limits.",
    retryable: false,
  },
  insufficient_history: {
    title: "More writing needed",
    message: "Add more writing samples so PickyTalker can estimate your style reliably.",
    retryable: false,
  },
  no_candidates: {
    title: "No responses returned",
    message: "No response candidates were available to rank.",
    retryable: true,
  },
  unexpected: {
    title: "Something went wrong",
    message: "PickyTalker couldn't complete this request. Please try again.",
    retryable: true,
  },
};

export function RetryAction({ onRetry, label = "Try again" }: { onRetry: () => void; label?: string }) {
  return (
    <button className="status-action" type="button" onClick={onRetry}>
      <RotateCcw aria-hidden="true" size={15} />
      {label}
    </button>
  );
}

type LoadingPanelProps = {
  title: string;
  message: string;
  longRunning?: boolean;
};

export function LoadingPanel({ title, message, longRunning = false }: LoadingPanelProps) {
  return (
    <div className="status-panel status-panel-loading" role="status" aria-live="polite" aria-busy="true">
      <LoaderCircle className="status-spinner" aria-hidden="true" size={20} />
      <div>
        <h3>{title}</h3>
        <p>{message}</p>
        {longRunning ? <p className="status-note">Generation can occasionally take up to a minute.</p> : null}
      </div>
    </div>
  );
}

export function EmptyState({ title, message, children }: { title: string; message: string; children?: ReactNode }) {
  return (
    <div className="status-panel status-panel-empty">
      <Inbox aria-hidden="true" size={20} />
      <div>
        <h3>{title}</h3>
        <p>{message}</p>
        {children}
      </div>
    </div>
  );
}

export function ErrorState({ kind, onRetry }: { kind: ApiErrorKind; onRetry?: () => void }) {
  const copy = ERROR_COPY[kind];
  return (
    <div className="status-panel status-panel-error" role="alert" aria-live="assertive">
      <AlertCircle aria-hidden="true" size={20} />
      <div>
        <h3>{copy.title}</h3>
        <p>{copy.message}</p>
        {copy.retryable && onRetry ? <RetryAction onRetry={onRetry} /> : null}
      </div>
    </div>
  );
}

export function SkeletonState({ label = "Loading content", rows = 3 }: { label?: string; rows?: number }) {
  return (
    <div className="skeleton-state" role="status" aria-label={label} aria-busy="true">
      {Array.from({ length: rows }, (_, index) => (
        <span key={index} className="skeleton-row" aria-hidden="true" />
      ))}
      <span className="sr-only">{label}</span>
    </div>
  );
}
