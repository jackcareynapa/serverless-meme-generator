"use client";

import { useCallback, useRef, useState } from "react";
import { MAX_FILE_BYTES } from "@/lib/limits";

const ACCEPT = "image/jpeg,image/png,image/webp,image/gif";

/**
 * Drag-and-drop target with local preview. Validates type and max size.
 * @param {string | null} [previewUrl] object URL for selected image
 */
export function UploadDropzone({ file, onFileSelect, children, disabled, previewUrl = null }) {
  const inputRef = useRef(null);
  const [dragOver, setDragOver] = useState(false);

  const selectFromList = (list) => {
    const f = list?.[0];
    if (!f) return;
    if (!f.type.startsWith("image/")) {
      onFileSelect({ error: "Please use a JPEG, PNG, WebP, or GIF file." });
      return;
    }
    if (f.size > MAX_FILE_BYTES) {
      onFileSelect({
        error: `Please keep images under ${Math.floor(MAX_FILE_BYTES / (1024 * 1024))}MB.`,
      });
      return;
    }
    onFileSelect({ file: f, error: null });
  };

  const onDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    if (disabled) return;
    selectFromList(e.dataTransfer.files);
  };

  const onInput = (e) => {
    if (disabled) return;
    selectFromList(e.target.files);
  };

  const onPick = useCallback(() => {
    if (!disabled) inputRef.current?.click();
  }, [disabled]);

  return (
    <div className="meme-card p-5 sm:p-6">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled) setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        className={[
          "relative flex min-h-[200px] cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-3 py-8 transition",
          disabled ? "pointer-events-none opacity-50" : "",
          dragOver ? "border-amber-200/80 bg-white/5" : "border-white/20 bg-white/5 hover:border-white/35",
        ].join(" ")}
        onClick={onPick}
        onKeyDown={(e) => e.key === "Enter" && onPick()}
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-label="Choose an image to upload"
      >
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          className="sr-only"
          onChange={onInput}
          disabled={disabled}
        />
        {file && previewUrl ? (
          <div className="flex w-full flex-col items-center gap-3 px-2">
            <img
              src={previewUrl}
              alt="Selected preview"
              className="max-h-40 w-auto max-w-full rounded-lg border border-white/10 object-contain"
            />
            <p className="text-center text-sm text-white/90">
              <span className="font-mono text-cyan-200/95">{file.name}</span>
              <span className="mt-1 block text-white/50">{(file.size / 1024).toFixed(0)} KB</span>
            </p>
          </div>
        ) : file ? (
          <p className="px-2 text-center text-sm text-white/90">
            <span className="font-mono text-cyan-200/95">{file.name}</span>
            <span className="mt-1 block text-white/50">
              {(file.size / 1024).toFixed(0)} KB
            </span>
          </p>
        ) : (
          <p className="px-2 text-center text-slate-200/90">
            Drop an image here, or <span className="text-amber-200/95">click to choose</span>
          </p>
        )}
      </div>
      {children ? <div className="mt-5">{children}</div> : null}
    </div>
  );
}
