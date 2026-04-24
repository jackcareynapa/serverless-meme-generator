const tone = {
  info: "border-cyan-400/40 bg-cyan-500/10 text-cyan-50",
  success: "border-emerald-400/40 bg-emerald-500/10 text-emerald-50",
  error: "border-rose-400/50 bg-rose-500/10 text-rose-50",
  processing: "border-amber-400/50 bg-amber-500/10 text-amber-50",
};

/**
 * Sticky, friendly status for demo audiences (upload, processing, done, oops).
 */
export function StatusBanner({ variant = "info", title, message, showSpinner }) {
  return (
    <div
      role="status"
      className={`flex flex-col gap-1 rounded-2xl border px-4 py-3 sm:flex-row sm:items-center sm:gap-3 ${tone[variant] || tone.info}`}
    >
      {showSpinner ? (
        <span className="inline-flex h-5 w-5 shrink-0 animate-spin rounded-full border-2 border-white/30 border-t-white" />
      ) : null}
      <div>
        {title ? <p className="font-semibold">{title}</p> : null}
        {message ? (
          <div className="text-sm opacity-90">
            {typeof message === "string" ? <p>{message}</p> : message}
          </div>
        ) : null}
      </div>
    </div>
  );
}
