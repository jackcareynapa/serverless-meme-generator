import { signGetObjectUrl, publicObjectHttpsUrl } from "../s3/urls.js";
import { outputObjectKeys } from "../s3/paths.js";

/**
 * @returns {boolean}
 */
function usePublicReadMode() {
  return (
    process.env.NEXT_PUBLIC_S3_READ_MODE === "public" &&
    Boolean(process.env.NEXT_PUBLIC_S3_BUCKET && process.env.NEXT_PUBLIC_S3_REGION)
  );
}

/**
 * @param {import('../s3/manifest.js').JobManifestV2} manifest
 * @param {import('../s3/status.js').JobStatusRecord} jobStatus
 * @param {{ captionSource?: string }} [extra]
 */
export async function toJobStatusPayload(manifest, jobStatus, extra = {}) {
  const { jobId, input, captions, createdAt } = manifest;
  const { status, error, outputKeys, updatedAt } = jobStatus;
  const base = {
    jobId,
    status,
    error: error || null,
    input: input || null,
    captions: (captions || []).map((c) => ({
      topText: c.topText,
      bottomText: c.bottomText,
    })),
    createdAt,
    updatedAt: updatedAt || jobStatus.createdAt,
    captionSource: extra.captionSource,
    readMode: /** @type {"public" | "presigned"} */ (usePublicReadMode() ? "public" : "presigned"),
  };

  if (status !== "completed" || !outputKeys || outputKeys.length !== 3) {
    return {
      ...base,
      variants: [1, 2, 3].map((i) => ({
        index: i,
        topText: captions?.[i - 1]?.topText ?? "",
        bottomText: captions?.[i - 1]?.bottomText ?? "",
        imageUrl: null,
        fileName: `meme-${i}.jpg`,
      })),
    };
  }

  const keys = outputObjectKeys(jobId);
  const variants = await Promise.all(
    [0, 1, 2].map(async (idx) => {
      const n = idx + 1;
      const key = outputKeys[idx] || keys[idx];
      let imageUrl;
      if (usePublicReadMode()) {
        imageUrl = publicObjectHttpsUrl(
          process.env.NEXT_PUBLIC_S3_BUCKET,
          process.env.NEXT_PUBLIC_S3_REGION,
          key
        );
      } else {
        imageUrl = await signGetObjectUrl(key, "image/jpeg");
      }
      return {
        index: n,
        topText: captions?.[idx]?.topText ?? "",
        bottomText: captions?.[idx]?.bottomText ?? "",
        imageUrl,
        fileName: `meme-${n}.jpg`,
      };
    })
  );
  return { ...base, variants };
}

export { usePublicReadMode };
