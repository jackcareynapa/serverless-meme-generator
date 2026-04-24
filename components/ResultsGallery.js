"use client";

import { useCallback, useState } from "react";

/**
 * @typedef {{ index: number, topText?: string, bottomText?: string, top?: string, bottom?: string, imageUrl: string | null, fileName: string }} Variant
 */

function lineTop(v) {
  return v.topText ?? v.top ?? "";
}

function lineBottom(v) {
  return v.bottomText ?? v.bottom ?? "";
}

async function downloadImage(url, fileName) {
  const r = await fetch(url, { mode: "cors", cache: "no-store" });
  if (!r.ok) throw new Error("Download failed—check S3 CORS for GET from this site.");
  const blob = await r.blob();
  const u = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = u;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(u);
}

/**
 * Original preview and one card per variant with download and copy.
 */
export function ResultsGallery({
  originalSrc,
  originalAlt = "Your upload",
  variants = [],
  processing = false,
  readMode = "presigned",
}) {
  const [copyOk, setCopyOk] = useState(null);

  const copyUrl = useCallback(async (url, index) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopyOk(index);
      setTimeout(() => setCopyOk(null), 2000);
    } catch {
      setCopyOk("err");
      setTimeout(() => setCopyOk(null), 2000);
    }
  }, []);

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-2">
      <div className="meme-card flex flex-col overflow-hidden sm:col-span-2 lg:col-span-1">
        <div className="border-b border-white/10 bg-black/25 px-4 py-3 text-left">
          <p className="font-display text-sm font-semibold text-amber-100/95">Original</p>
          <p className="text-xs text-white/45">Source image (browser uploads with a presigned PUT).</p>
        </div>
        <div className="relative flex min-h-[220px] flex-1 items-center justify-center bg-black/25 p-3">
          {originalSrc ? (
            <img
              src={originalSrc}
              alt={originalAlt}
              className="max-h-80 w-auto max-w-full rounded-lg object-contain"
            />
          ) : (
            <p className="p-6 text-center text-sm text-white/45">Select an image to preview it here.</p>
          )}
        </div>
      </div>

      {variants.map((v) => {
        const ready = Boolean(v.imageUrl);
        const t = lineTop(v);
        const b = lineBottom(v);
        const labelTop = t || `Variant ${v.index}`;
        return (
          <div key={v.index} className="meme-card flex flex-col overflow-hidden">
            <div className="border-b border-white/10 bg-black/25 px-4 py-3 text-left">
              <p className="font-display text-sm font-semibold text-rose-100/95 line-clamp-2">
                {labelTop}
              </p>
              <p className="mt-0.5 line-clamp-2 text-xs text-white/45">{b || "—"}</p>
            </div>
            <div className="relative flex min-h-[220px] flex-1 items-center justify-center bg-black/20 p-3">
              {!ready && processing ? (
                <div className="flex flex-col items-center gap-3 p-4">
                  <span className="h-10 w-10 animate-spin rounded-full border-2 border-rose-300/30 border-t-rose-200" />
                  <p className="text-center text-sm text-slate-200/90">Variant {v.index} of 3…</p>
                </div>
              ) : !ready && !processing ? (
                <p className="p-4 text-center text-sm text-white/40">Ready when you generate.</p>
              ) : (
                <img
                  src={v.imageUrl}
                  alt={labelTop}
                  className="max-h-80 w-auto max-w-full rounded-lg object-contain"
                />
              )}
            </div>
            {ready ? (
              <div className="flex flex-wrap items-center justify-end gap-2 border-t border-white/10 bg-black/20 px-3 py-2">
                <button
                  type="button"
                  onClick={() => downloadImage(v.imageUrl, v.fileName).catch((e) => alert(e?.message))}
                  className="rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-medium text-white/95 hover:bg-white/15"
                >
                  Download
                </button>
                <button
                  type="button"
                  onClick={() => copyUrl(v.imageUrl, v.index)}
                  className="rounded-full border border-white/20 bg-transparent px-3 py-1.5 text-xs text-slate-200/90 hover:bg-white/10"
                  title={
                    readMode === "presigned"
                      ? "Link expires; copy while valid."
                      : "Copy public URL"
                  }
                >
                  {copyOk === v.index ? "Copied" : copyOk === "err" ? "Copy failed" : "Copy link"}
                </button>
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
