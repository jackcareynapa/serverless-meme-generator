"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { HeroSection } from "@/components/HeroSection";
import { UploadDropzone } from "@/components/UploadDropzone";
import { MemeForm } from "@/components/MemeForm";
import { ProcessingPanel } from "@/components/ProcessingPanel";
import { ResultsGallery } from "@/components/ResultsGallery";
import { ErrorPanel } from "@/components/ErrorPanel";
import { StatusBanner } from "@/components/StatusBanner";
import { MEME_STYLES, normalizeStyle } from "@/lib/captions/styles";

const POLL_MS = 1500;
const POLL_MAX = 64;

/**
 * Puts a file to a presigned S3 URL; reports upload progress.
 */
function putToPresignedUrl(presignedUrl, file, headers, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", presignedUrl);
    const ct = headers?.["Content-Type"] || file.type;
    if (ct) xhr.setRequestHeader("Content-Type", ct);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else
        reject(
          new Error(
            `S3 returned ${xhr.status}. Check CORS (PUT to your bucket), the presigned policy, and Content-Type.`
          )
        );
    };
    xhr.onerror = () => reject(new Error("Network error while uploading to S3."));
    xhr.send(file);
  });
}

/**
 * @param {unknown} data
 * @param {Array<{ topText: string, bottomText: string }> | undefined} [fallbackCaptions]
 */
function toGalleryVariants(data, fallbackCaptions) {
  if (data && Array.isArray(data.variants)) {
    return data.variants;
  }
  if (Array.isArray(fallbackCaptions)) {
    return [0, 1, 2].map((i) => ({
      index: i + 1,
      topText: fallbackCaptions[i]?.topText ?? "",
      bottomText: fallbackCaptions[i]?.bottomText ?? "",
      imageUrl: null,
      fileName: `meme-${i + 1}.jpg`,
    }));
  }
  return [1, 2, 3].map((n) => ({
    index: n,
    topText: "",
    bottomText: "",
    imageUrl: null,
    fileName: `meme-${n}.jpg`,
  }));
}

export default function HomePage() {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [context, setContext] = useState("");
  const [style, setStyle] = useState(MEME_STYLES[2]);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [phase, setPhase] = useState("idle");
  const [error, setError] = useState(null);
  const [jobId, setJobId] = useState(null);
  const [lastPayload, setLastPayload] = useState(null);
  const [pendingCaptions, setPendingCaptions] = useState(null);
  const [remoteStatus, setRemoteStatus] = useState(null);
  const [readMode, setReadMode] = useState("presigned");

  const resetForNewFile = useCallback(
    (f) => {
      setError(null);
      setUploadProgress(0);
      setJobId(null);
      setLastPayload(null);
      setPendingCaptions(null);
      setRemoteStatus(null);
      setPhase("idle");
      if (f) {
        if (preview) URL.revokeObjectURL(preview);
        setFile(f);
        setPreview(URL.createObjectURL(f));
      }
    },
    [preview]
  );

  const onFileSelect = useCallback(
    (payload) => {
      if (payload.error) {
        setError(payload.error);
        return;
      }
      if (payload.file) {
        resetForNewFile(payload.file);
        setError(null);
      }
    },
    [resetForNewFile]
  );

  useEffect(
    () => () => {
      if (preview) URL.revokeObjectURL(preview);
    },
    [preview]
  );

  const runJob = useCallback(async () => {
    if (!file) return;
    setError(null);
    setPhase("uploading");
    setUploadProgress(0);
    setLastPayload(null);
    setJobId(null);
    setRemoteStatus(null);
    setPendingCaptions(null);
    let data;
    try {
      const r = await fetch("/api/create-job", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileName: file.name,
          contentType: file.type || "image/jpeg",
          fileSize: file.size,
          context,
          style: normalizeStyle(style),
        }),
      });
      data = await r.json();
      if (!r.ok) throw new Error(data.error || "Could not start job");
    } catch (e) {
      setError(e?.message || "Request failed");
      setPhase("error");
      return;
    }

    const { uploadUrl, jobId: id, contentType, requiredHeaders, captions: caps } = data;
    setPendingCaptions(Array.isArray(caps) ? caps : null);
    setJobId(id);
    const headers = requiredHeaders || { "Content-Type": contentType || file.type || "image/jpeg" };

    try {
      await putToPresignedUrl(uploadUrl, file, headers, setUploadProgress);
    } catch (e) {
      setError(e?.message || "Upload failed");
      setPhase("error");
      return;
    }

    setPhase("processing");
  }, [file, context, style]);

  useEffect(() => {
    if (phase !== "processing" || !jobId) return undefined;
    let cancelled = false;
    let n = 0;
    (async function poll() {
      while (n < POLL_MAX) {
        if (cancelled) return;
        try {
          const r = await fetch(
            `/api/job-status?jobId=${encodeURIComponent(jobId)}`,
            { cache: "no-store" }
          );
          const data = await r.json();
          if (!r.ok) {
            if (r.status === 404) {
              if (!cancelled) {
                setError("Job not found. The id may be invalid or data was removed.");
                setPhase("error");
              }
              return;
            }
            throw new Error(data.error || "Status request failed");
          }
          if (!cancelled) {
            setLastPayload(data);
            setRemoteStatus(data.status);
            if (data.readMode) setReadMode(data.readMode);
          }
          if (data.status === "completed" && !cancelled) {
            setPhase("done");
            return;
          }
          if (data.status === "failed" && !cancelled) {
            setError(data.error || "Image processing failed.");
            setPhase("error");
            return;
          }
        } catch (e) {
          if (!cancelled) {
            setError(e?.message || "Status polling failed");
            setPhase("error");
            return;
          }
          return;
        }
        n += 1;
        await new Promise((r) => setTimeout(r, POLL_MS));
      }
      if (!cancelled) {
        setError(
          "Timed out waiting for results. If uploads succeed, check the S3 → Lambda trigger (prefix uploads/), CloudWatch, and S3 CORS for GETs used by the gallery."
        );
        setPhase("error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [phase, jobId]);

  const busy = phase === "uploading" || phase === "processing";
  const variants = useMemo(
    () => toGalleryVariants(lastPayload, pendingCaptions),
    [lastPayload, pendingCaptions]
  );

  const onRetry = useCallback(() => {
    if (!file) {
      setError("Choose an image first.");
      return;
    }
    setError(null);
    runJob();
  }, [file, runJob]);

  return (
    <div className="mx-auto min-h-dvh max-w-6xl px-4 pb-24 pt-10 sm:px-6 sm:pt-16">
      <HeroSection />

      {error ? (
        <ErrorPanel
          message={error}
          onRetry={onRetry}
          onDismiss={() => {
            setError(null);
            if (phase === "error") setPhase("idle");
          }}
          showRetry={Boolean(file)}
        />
      ) : null}

      <ProcessingPanel phase={phase} uploadProgress={uploadProgress} jobStatus={remoteStatus} />

      {phase === "done" && lastPayload?.status === "completed" ? (
        <div className="mb-6">
          <StatusBanner
            variant="success"
            title="All three variants are ready"
            message="Use download or copy link. If you use presigned URLs, they expire; refresh job status to get new ones."
          />
        </div>
      ) : null}

      <div className="mb-8 grid gap-4 lg:grid-cols-2">
        <div className="space-y-4">
          <UploadDropzone
            file={file}
            previewUrl={preview}
            onFileSelect={onFileSelect}
            disabled={busy}
          >
            <div className="flex flex-wrap items-center justify-center gap-2">
              <button
                type="button"
                onClick={() => {
                  if (!busy) {
                    if (preview) {
                      URL.revokeObjectURL(preview);
                    }
                    setFile(null);
                    setPreview(null);
                    setError(null);
                    setPhase("idle");
                    setJobId(null);
                    setLastPayload(null);
                    setPendingCaptions(null);
                  }
                }}
                disabled={busy}
                className="rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm text-white/95 hover:bg-white/20 disabled:opacity-50"
              >
                Clear
              </button>
              <button
                type="button"
                onClick={runJob}
                disabled={busy || !file}
                className="rounded-full bg-gradient-to-r from-rose-500 to-amber-500 px-6 py-2.5 text-sm font-semibold text-slate-950 shadow-lg shadow-rose-900/25 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {busy ? "Working…" : "Generate memes"}
              </button>
            </div>
          </UploadDropzone>
        </div>
        <MemeForm
          context={context}
          style={style}
          onContextChange={setContext}
          onStyleChange={setStyle}
          disabled={busy}
        />
      </div>

      <div className="mb-2 flex items-center justify-between gap-2">
        <h2 className="font-display text-lg font-semibold text-white/90 sm:text-xl">Results</h2>
        {jobId && phase === "done" ? (
          <p className="text-xs text-white/40">Job: {jobId}</p>
        ) : null}
      </div>
      {file ? (
        <ResultsGallery
          originalSrc={preview}
          originalAlt="Original image"
          variants={variants}
          processing={phase === "processing"}
          readMode={readMode}
        />
      ) : (
        <p className="meme-card p-6 text-sm text-slate-300/90">
          Drop an image to see your source preview and, after you generate, three JPEG memes with AI-written captions
          and Lambda compositing.
        </p>
      )}

      <p className="mt-6 text-center text-xs leading-relaxed text-white/40">
        Flow: Vercel creates the job and writes manifest + status in S3, OpenAI returns captions, your browser uploads
        with a presigned PUT, Lambda renders with Sharp, and this page polls for completion—no always-on app server.
      </p>
    </div>
  );
}
