/**
 * Job status: mutable lifecycle in S3; updated by Lambda. Presigned URLs are not stored here.
 * @typedef { 'pending' | 'processing' | 'completed' | 'failed' } PipelineStatus
 * @typedef {{
 *   version: number,
 *   jobId: string,
 *   status: PipelineStatus,
 *   createdAt: string,
 *   updatedAt: string,
 *   error: string | null,
 *   outputKeys: string[],
 *   processingStartedAt?: string,
 *   completedAt?: string,
 * }} JobStatusRecord
 */

export const STATUS_VERSION = 1;

/**
 * @param {string} jobId
 * @returns {JobStatusRecord}
 */
export function createInitialJobStatus(jobId) {
  const now = new Date().toISOString();
  return {
    version: STATUS_VERSION,
    jobId,
    status: "pending",
    createdAt: now,
    updatedAt: now,
    error: null,
    outputKeys: [],
  };
}

/**
 * @param {unknown} data
 * @returns {JobStatusRecord | null}
 */
export function parseJobStatus(data) {
  if (!data || typeof data !== "object") return null;
  const o = /** @type {Record<string, unknown>} */ (data);
  if (o.version !== STATUS_VERSION) return null;
  if (typeof o.jobId !== "string") return null;
  if (typeof o.status !== "string") return null;
  if (typeof o.createdAt !== "string" || typeof o.updatedAt !== "string") return null;
  if (!Array.isArray(o.outputKeys)) return null;
  return /** @type {JobStatusRecord} */ (data);
}
