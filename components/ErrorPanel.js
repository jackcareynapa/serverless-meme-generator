"use client";

import { StatusBanner } from "./StatusBanner";

/**
 * Error surface with retry and dismiss.
 */
export function ErrorPanel({ message, onRetry, onDismiss, showRetry = true }) {
  if (!message) return null;
  return (
    <div className="mb-6 space-y-2">
      <StatusBanner variant="error" title="Something went wrong" message={message} />
      {showRetry && onRetry ? (
        <div className="flex flex-wrap items-center justify-end gap-2">
          <button
            type="button"
            onClick={onRetry}
            className="rounded-md border border-rose-200/30 bg-rose-500/10 px-3 py-1.5 text-sm font-medium text-rose-50 hover:bg-rose-500/20"
          >
            Try again
          </button>
          {onDismiss ? (
            <button
              type="button"
              onClick={onDismiss}
              className="rounded-md border border-white/20 px-3 py-1.5 text-sm text-slate-200/90 hover:bg-white/10"
            >
              Dismiss
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
