/**
 * S3 ObjectCreated on uploads/{jobId}/original.* → read manifest, render 3 JPEGs, update manifest.
 * Ignores non-original keys and the outputs/ prefix (trigger should be uploads/ only).
 */
import { GetObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import sharp from "sharp";

const client = new S3Client({});

const UPLOAD_PREFIX = "uploads/";
const JOBS_PREFIX = "jobs/";
const OUT_PREFIX = "outputs/";
const MANIFEST_NAME = "manifest.json";

const MANIFEST_READ_RETRIES = 4;
const MANIFEST_READ_DELAY_MS = 200;

/**
 * Renders a full-size image overlay (white + black stroke) for top/bottom meme text.
 * DejaVu from Lambda layer; set FONTCONFIG_FILE=/opt/fonts/fonts.conf.
 */
function buildCaptionSvg({ width, height, top, bottom }) {
  const font = Math.max(22, Math.round(Math.min(width, height) * 0.07));
  const escape = (s) =>
    String(s)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");

  const memeFont = "'DejaVu Sans', 'DejaVu Sans Book', sans-serif";

  return `
<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <filter id="s" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="2" stdDeviation="0" flood-color="#000" flood-opacity="0.85" />
    </filter>
  </defs>
  <text x="50%" y="${Math.round(font * 1.4)}"
    text-anchor="middle"
    font-family="${memeFont}"
    font-size="${font}"
    font-weight="700"
    fill="#fff"
    stroke="#000"
    stroke-width="${Math.max(2, font * 0.05)}"
    paint-order="stroke fill"
    filter="url(#s)">
    ${escape(top)}
  </text>
  <text x="50%" y="${height - Math.round(font * 0.5)}"
    text-anchor="middle"
    font-family="${memeFont}"
    font-size="${font}"
    font-weight="700"
    fill="#fff"
    stroke="#000"
    stroke-width="${Math.max(2, font * 0.05)}"
    paint-order="stroke fill"
    filter="url(#s)">
    ${escape(bottom)}
  </text>
</svg>`.trim();
}

async function getObjectBuffer(Bucket, Key) {
  const o = await client.send(new GetObjectCommand({ Bucket, Key }));
  if (!o.Body) throw new Error("empty body");
  return Buffer.from(await o.Body.transformToByteArray());
}

async function getObjectTextWithRetry(Bucket, Key) {
  for (let attempt = 0; attempt < MANIFEST_READ_RETRIES; attempt += 1) {
    try {
      const buf = await getObjectBuffer(Bucket, Key);
      return buf.toString("utf8");
    } catch (e) {
      if (e?.name === "NoSuchKey" && attempt < MANIFEST_READ_RETRIES - 1) {
        await new Promise((r) => setTimeout(r, MANIFEST_READ_DELAY_MS * (attempt + 1)));
        continue;
      }
      throw e;
    }
  }
  return "";
}

async function putJson(Bucket, Key, obj) {
  const Body = JSON.stringify(obj);
  await client.send(
    new PutObjectCommand({
      Bucket,
      Key,
      Body,
      ContentType: "application/json; charset=utf-8",
    })
  );
}

/** @param {string} key */
function parseOriginalUploadKey(key) {
  const re = new RegExp(`^${escapeRe(UPLOAD_PREFIX)}([^/]+)/original\\.[^/]+$`);
  const m = re.exec(key);
  if (!m) return null;
  return m[1];
}

function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function headExists(Bucket, Key) {
  try {
    await client.send(new HeadObjectCommand({ Bucket, Key }));
    return true;
  } catch (e) {
    if (e?.$metadata?.httpStatusCode === 404 || e?.name === "NotFound" || e?.Code === "NotFound")
      return false;
    throw e;
  }
}

/**
 * @param {object} p
 * @param {{ top: string, bottom: string }[]} p.captions
 * @param {Buffer} p.imageBuffer
 */
async function buildMemeJpeg(p) {
  const { top, bottom } = p;
  const { data, info } = await sharp(p.imageBuffer)
    .rotate()
    .resize({ width: 800, withoutEnlargement: true, fit: "inside" })
    .toBuffer({ resolveWithObject: true });

  const w = info.width;
  const h = info.height;
  const svg = buildCaptionSvg({ width: w, height: h, top, bottom });
  const textPng = await sharp(Buffer.from(svg)).png().toBuffer();
  return sharp(data)
    .composite([{ input: textPng, top: 0, left: 0 }])
    .jpeg({ quality: 86, mozjpeg: true })
    .toBuffer();
}

function manifestKeyForJob(jobId) {
  return `${JOBS_PREFIX}${jobId}/${MANIFEST_NAME}`;
}

function outputKey(jobId, n) {
  return `${OUT_PREFIX}${jobId}/meme-${n}.jpg`;
}

export async function handler(event) {
  const record = event.Records?.[0];
  if (!record) return;
  const bucket = record.s3?.bucket?.name;
  const key = decodeURIComponent(record.s3?.object?.key?.replaceAll("+", " ") ?? "");
  if (!bucket || !key) {
    console.warn("lambda_missing_event_fields");
    return;
  }
  if (!key.startsWith(UPLOAD_PREFIX)) {
    console.log("lambda_skip_non_upload_prefix", key);
    return;
  }
  const jobId = parseOriginalUploadKey(key);
  if (!jobId) {
    console.log("lambda_skip_non_original_key", key);
    return;
  }

  const mKey = manifestKeyForJob(jobId);
  const start = Date.now();
  let manifest;
  let raw;
  try {
    raw = await getObjectTextWithRetry(bucket, mKey);
  } catch (e) {
    console.error("lambda_manifest_read_fail", { jobId, err: e?.message });
    return;
  }
  try {
    manifest = JSON.parse(raw);
  } catch (e) {
    console.error("lambda_manifest_json", { jobId, err: e?.message });
    return;
  }

  if (manifest?.version !== 1 || !Array.isArray(manifest.captions) || manifest.captions.length !== 3) {
    const failed = {
      ...manifest,
      jobId: manifest?.jobId || jobId,
      status: "failed",
      error: "Invalid manifest: expected version 1 and 3 caption pairs.",
      updatedAt: new Date().toISOString(),
    };
    try {
      await putJson(bucket, mKey, failed);
    } catch (e) {
      console.error("lambda_write_fail_manifest", e?.message);
    }
    return;
  }

  const outputKeys = [1, 2, 3].map((n) => outputKey(jobId, n));
  if (manifest.status === "complete" && manifest.outputKeys?.length === 3) {
    const all = await Promise.all(outputKeys.map((k) => headExists(bucket, k)));
    if (all.every(Boolean)) {
      console.log("lambda_idempotent_skip", { jobId, ms: Date.now() - start });
      return;
    }
  }

  if ((await Promise.all(outputKeys.map((k) => headExists(bucket, k)))).every(Boolean)) {
    const done = {
      ...manifest,
      status: "complete",
      outputKeys,
      completedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await putJson(bucket, mKey, done);
    return;
  }

  let imageBuffer;
  try {
    imageBuffer = await getObjectBuffer(bucket, key);
  } catch (e) {
    console.error("lambda_get_upload", e);
    return;
  }

  const processing = {
    ...manifest,
    status: "processing",
    processingStartedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    error: null,
  };
  await putJson(bucket, mKey, processing);

  try {
    for (let i = 0; i < 3; i += 1) {
      const cap = manifest.captions[i];
      const outKey = outputKeys[i];
      const jpg = await buildMemeJpeg({
        top: String(cap.top || "TOP"),
        bottom: String(cap.bottom || "BOTTOM"),
        imageBuffer,
      });
      await client.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: outKey,
          Body: jpg,
          ContentType: "image/jpeg",
        })
      );
      console.log("lambda_wrote", outKey);
    }
    const complete = {
      ...manifest,
      status: "complete",
      error: null,
      outputKeys,
      completedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await putJson(bucket, mKey, complete);
  } catch (e) {
    console.error("lambda_process_error", e);
    const failed = {
      ...manifest,
      status: "failed",
      error: e?.message || "Image processing failed.",
      updatedAt: new Date().toISOString(),
    };
    try {
      await putJson(bucket, mKey, failed);
    } catch (e2) {
      console.error("lambda_failed_manifest_write", e2);
    }
  }
  console.log("lambda_done", { jobId, ms: Date.now() - start });
}
