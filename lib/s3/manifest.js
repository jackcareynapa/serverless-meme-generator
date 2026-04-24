/**
 * Job manifest v2: immutable job definition from Vercel (captions + input). No processing state here.
 * @typedef {{ topText: string, bottomText: string }} CaptionPairV2
 * @typedef {{
 *   filename: string,
 *   contentType: string,
 *   tone: string,
 *   prompt: string,
 * }} JobInputV2
 * @typedef {{
 *   version: number,
 *   jobId: string,
 *   createdAt: string,
 *   input: JobInputV2,
 *   captions: CaptionPairV2[],
 * }} JobManifestV2
 */

export const MANIFEST_VERSION = 2;

/**
 * @param {object} input
 * @param {string} input.jobId
 * @param {string} input.filename
 * @param {string} input.contentType
 * @param {string} input.tone
 * @param {string} input.prompt
 * @param {CaptionPairV2[]} input.captions
 * @returns {JobManifestV2}
 */
export function createJobManifest({ jobId, filename, contentType, tone, prompt, captions }) {
  const now = new Date().toISOString();
  return {
    version: MANIFEST_VERSION,
    jobId,
    createdAt: now,
    input: {
      filename: filename || "",
      contentType: contentType || "image/jpeg",
      tone: tone || "relatable",
      prompt: typeof prompt === "string" ? prompt : "",
    },
    captions: captions.map((c) => ({
      topText: c.topText,
      bottomText: c.bottomText,
    })),
  };
}

/**
 * @param {unknown} data
 * @returns {JobManifestV2 | null}
 */
export function parseJobManifest(data) {
  if (!data || typeof data !== "object") return null;
  const o = /** @type {Record<string, unknown>} */ (data);
  if (o.version !== MANIFEST_VERSION) return null;
  if (typeof o.jobId !== "string") return null;
  if (typeof o.createdAt !== "string") return null;
  if (!o.input || typeof o.input !== "object") return null;
  if (!Array.isArray(o.captions) || o.captions.length !== 3) return null;
  const input = /** @type {Record<string, unknown>} */ (o.input);
  if (typeof input.filename !== "string" || typeof input.contentType !== "string") return null;
  if (typeof input.tone !== "string") return null;
  if (typeof input.prompt !== "string") return null;
  for (const c of o.captions) {
    if (!c || typeof c !== "object") return null;
    const p = /** @type {Record<string, unknown>} */ (c);
    if (typeof p.topText !== "string" || typeof p.bottomText !== "string") return null;
  }
  return /** @type {JobManifestV2} */ (data);
}

/**
 * @param {JobManifestV2} m
 * @returns {boolean}
 */
export function manifestHasThreeCaptions(m) {
  return (
    m.captions.length === 3 &&
    m.captions.every((c) => c.topText?.trim() && c.bottomText?.trim())
  );
}
