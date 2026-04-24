/**
 * S3 key layout (single source of truth for Vercel routes + Lambda + docs):
 * - uploads/{jobId}/original.{ext}
 * - jobs/{jobId}/manifest.json (job definition + captions)
 * - jobs/{jobId}/status.json (lifecycle + output keys)
 * - outputs/{jobId}/meme-{1..3}.jpg
 */

const UPLOAD_PREFIX = "uploads";
const JOBS_PREFIX = "jobs";
const OUTPUTS_PREFIX = "outputs";

const ALLOWED_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp", ".gif"];

const MIME_TO_EXT = {
  "image/jpeg": ".jpg",
  "image/jpg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/gif": ".gif",
};

/** @param {string} fileName */
export function fileExtensionFromName(fileName) {
  const i = fileName.lastIndexOf(".");
  if (i < 0) return "";
  const ext = fileName.slice(i).toLowerCase();
  return ext.length <= 8 && ALLOWED_EXTENSIONS.includes(ext) ? ext : "";
}

/**
 * @param {string} contentType
 * @param {string} [fallbackFromFileName] e.g. ".png"
 */
export function normalizeExtensionForUpload(contentType, fallbackFromFileName = "") {
  const fromMime = MIME_TO_EXT[contentType?.toLowerCase?.() || ""];
  if (fromMime) return fromMime;
  if (fallbackFromFileName && ALLOWED_EXTENSIONS.includes(fallbackFromFileName.toLowerCase())) {
    return fallbackFromFileName.toLowerCase() === ".jpeg" ? ".jpg" : fallbackFromFileName.toLowerCase();
  }
  return ".jpg";
}

/** @param {string} jobId @param {string} ext e.g. ".jpg" */
export function uploadObjectKey(jobId, ext) {
  const e = ext.startsWith(".") ? ext : `.${ext}`;
  return `${UPLOAD_PREFIX}/${jobId}/original${e === ".jpeg" ? ".jpg" : e}`;
}

/** @param {string} jobId */
export function jobManifestKey(jobId) {
  return `${JOBS_PREFIX}/${jobId}/manifest.json`;
}

/** @param {string} jobId */
export function jobStatusKey(jobId) {
  return `${JOBS_PREFIX}/${jobId}/status.json`;
}

/** @param {string} jobId @param {1|2|3} n */
export function outputObjectKey(jobId, n) {
  return `${OUTPUTS_PREFIX}/${jobId}/meme-${n}.jpg`;
}

/**
 * @param {string} jobId
 * @returns {[`${string}/meme-1.jpg`, `${string}/meme-2.jpg`, `${string}/meme-3.jpg`]}
 */
export function outputObjectKeys(jobId) {
  return [1, 2, 3].map((i) => outputObjectKey(jobId, /** @type {1|2|3} */ (i)));
}

/**
 * @param {string} objectKey
 * @returns {{ jobId: string, ext: string } | null}
 */
export function parseUploadOriginalKey(objectKey) {
  const m = new RegExp(
    `^${escapeRe(UPLOAD_PREFIX)}/([^/]+)/original\\.([^/]+)$`
  ).exec(objectKey);
  if (!m) return null;
  return { jobId: m[1], ext: m[2] };
}

function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export { UPLOAD_PREFIX, JOBS_PREFIX, OUTPUTS_PREFIX, ALLOWED_EXTENSIONS, MIME_TO_EXT };
