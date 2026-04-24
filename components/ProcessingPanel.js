"use client";

import { StatusBanner } from "./StatusBanner";

/**
 * Upload progress bar and pipeline status while waiting on Lambda.
 */
export function ProcessingPanel({ phase, uploadProgress, jobStatus }) {
  if (phase === "uploading") {
    return (
      <div className="mb-6">
        <div className="mb-2 h-2 overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-gradient-to-r from-rose-400/90 to-amber-300/90 transition-all duration-300"
            style={{ width: `${Math.min(100, Math.max(0, uploadProgress))}%` }}
          />
        </div>
        <p className="text-center text-sm text-slate-200/85">Uploading securely to S3… {uploadProgress}%</p>
      </div>
    );
  }
  if (phase === "processing") {
    const extra =
      jobStatus === "pending"
        ? "Job is registered. When your image lands, an S3 event starts rendering in Lambda."
        : jobStatus === "processing"
          ? "Lambda is compositing text with Sharp—usually a few seconds."
          : "Rendering…";
    return (
      <div className="mb-6">
        <StatusBanner variant="processing" showSpinner title="Baking your memes" message={extra} />
      </div>
    );
  }
  return null;
}
