"use client";

import { MEME_STYLES } from "@/lib/captions/styles";

const LABELS = {
  absurd: "Absurd",
  corporate: "Corporate",
  relatable: "Relatable",
  dramatic: "Dramatic",
  wholesome: "Wholesome",
};

/**
 * Meme idea (prompt) + tone chips.
 */
export function MemeForm({ context, style, onContextChange, onStyleChange, disabled }) {
  return (
    <div className="meme-card p-5 sm:p-6">
      <h2 className="mb-2 font-display text-sm font-semibold text-white/95">Idea &amp; tone</h2>
      <p className="mb-4 text-sm leading-relaxed text-slate-300/90">
        Optional prompt: what should the punchlines riff on? Tone steers how the model writes—three distinct variants
        per run.
      </p>
      <label className="mb-1 block text-xs font-medium uppercase tracking-wider text-white/50">
        Meme idea
      </label>
      <textarea
        value={context}
        onChange={(e) => onContextChange(e.target.value)}
        disabled={disabled}
        maxLength={2000}
        rows={4}
        placeholder="e.g. Friday deploy, standup that could have been an email, when the linter finally passes…"
        className="mb-5 w-full resize-y rounded-xl border border-white/15 bg-black/25 px-3 py-2.5 text-sm text-white/95 placeholder:text-white/30 focus:border-amber-200/50 focus:outline-none focus:ring-1 focus:ring-amber-200/30 disabled:opacity-50"
      />
      <p className="mb-2 text-xs font-medium uppercase tracking-wider text-white/50">Tone</p>
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Meme tone">
        {MEME_STYLES.map((s) => {
          const active = s === style;
          return (
            <button
              key={s}
              type="button"
              role="radio"
              aria-checked={active}
              disabled={disabled}
              onClick={() => onStyleChange(s)}
              className={[
                "rounded-full border px-3 py-1.5 text-sm font-medium transition",
                active
                  ? "border-amber-200/70 bg-amber-400/15 text-amber-100"
                  : "border-white/20 bg-white/5 text-slate-200/90 hover:border-white/40",
                disabled ? "pointer-events-none opacity-50" : "",
              ].join(" ")}
            >
              {LABELS[s] || s}
            </button>
          );
        })}
      </div>
    </div>
  );
}
