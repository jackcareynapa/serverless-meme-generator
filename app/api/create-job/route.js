import { randomUUID } from "node:crypto";
import { generateCaptionPairs } from "@/lib/captions/generate";
import { isValidStyle, normalizeStyle } from "@/lib/captions/styles";
import { createJobManifest } from "@/lib/s3/manifest";
import { createInitialJobStatus } from "@/lib/s3/status";
import { getBucketName, getS3Client } from "@/lib/s3/client";
import {
  fileExtensionFromName,
  jobManifestKey,
  jobStatusKey,
  normalizeExtensionForUpload,
  uploadObjectKey,
} from "@/lib/s3/paths";
import { putObjectJson } from "@/lib/s3/ops";
import { signPutObjectUrl, DEFAULT_PUT_EXPIRES } from "@/lib/s3/urls";
import { MAX_FILE_BYTES } from "@/lib/limits";

const ALLOWED_TYPES = new Set(["image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif"]);

function err(msg, status = 400) {
  return Response.json({ error: msg }, { status });
}

export async function POST(request) {
  try {
    getS3Client();
    getBucketName();
  } catch (e) {
    return err(e?.message || "Server configuration error (AWS/S3).", 500);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return err("Invalid JSON body.");
  }

  const fileName = typeof body.fileName === "string" ? body.fileName : "";
  const contentType = typeof body.contentType === "string" ? body.contentType : "";
  const context = typeof body.context === "string" ? body.context.slice(0, 2000) : "";
  const styleRaw = typeof body.style === "string" ? body.style : "relatable";
  const fileSize = typeof body.fileSize === "number" ? body.fileSize : null;

  if (!fileName) return err("fileName is required.");
  if (!contentType) return err("contentType is required.");
  if (!ALLOWED_TYPES.has(contentType.toLowerCase())) {
    return err("Unsupported file type. Use JPEG, PNG, WebP, or GIF.");
  }
  if (fileSize != null && (fileSize < 1 || fileSize > MAX_FILE_BYTES)) {
    return err(`File must be under ${Math.floor(MAX_FILE_BYTES / (1024 * 1024))}MB.`);
  }
  if (!isValidStyle(styleRaw)) {
    return err("style must be one of: absurd, corporate, relatable, dramatic, wholesome.");
  }
  const tone = normalizeStyle(styleRaw);

  const jobId = randomUUID();
  const fromName = fileExtensionFromName(fileName);
  const ext = normalizeExtensionForUpload(contentType, fromName);
  const uploadKey = uploadObjectKey(jobId, ext);
  const manifestKey = jobManifestKey(jobId);
  const statusKey = jobStatusKey(jobId);

  let pairResult;
  try {
    pairResult = await generateCaptionPairs({ context, style: tone, jobId, mode: "auto" });
  } catch (e) {
    console.error("caption_error", e);
    return err(e?.message || "Caption generation failed.", 500);
  }

  const manifest = createJobManifest({
    jobId,
    filename: fileName,
    contentType: contentType.toLowerCase(),
    tone,
    prompt: context,
    captions: pairResult.pairs,
  });

  const status = createInitialJobStatus(jobId);

  try {
    await putObjectJson(manifestKey, JSON.stringify(manifest, null, 0));
  } catch (e) {
    console.error("put_manifest", e);
    return err("Could not create job in storage. Check IAM (s3:PutObject on jobs/*).", 500);
  }

  try {
    await putObjectJson(statusKey, JSON.stringify(status, null, 0));
  } catch (e) {
    console.error("put_status", e);
    return err("Could not create job status in storage. Check IAM (s3:PutObject on jobs/*).", 500);
  }

  let uploadUrl;
  try {
    uploadUrl = await signPutObjectUrl(uploadKey, contentType, DEFAULT_PUT_EXPIRES);
  } catch (e) {
    console.error("sign_put", e);
    return err("Could not create upload URL. Check IAM (s3:PutObject on uploads/*).", 500);
  }

  return Response.json({
    jobId,
    uploadUrl,
    uploadKey,
    objectKey: uploadKey,
    contentType,
    requiredHeaders: { "Content-Type": contentType },
    expiresIn: DEFAULT_PUT_EXPIRES,
    pollUrl: `/api/job-status?jobId=${encodeURIComponent(jobId)}`,
    captionSource: pairResult.source,
    captions: pairResult.pairs,
  });
}
