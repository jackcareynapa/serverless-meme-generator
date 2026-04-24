import { GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { getS3Client, getBucketName } from "./client.js";

const DEFAULT_PUT_EXPIRES = 300;
const DEFAULT_GET_EXPIRES = 600;

/**
 * @param {string} key
 * @param {string} contentType
 * @param {number} [expiresIn]
 */
export async function signPutObjectUrl(key, contentType, expiresIn = DEFAULT_PUT_EXPIRES) {
  const client = getS3Client();
  const bucket = getBucketName();
  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    ContentType: contentType,
  });
  return getSignedUrl(client, command, { expiresIn });
}

/**
 * @param {string} key
 * @param {string} [contentType] optional response content type hint
 * @param {number} [expiresIn]
 */
export async function signGetObjectUrl(
  key,
  contentType = "image/jpeg",
  expiresIn = DEFAULT_GET_EXPIRES
) {
  const client = getS3Client();
  const bucket = getBucketName();
  const command = new GetObjectCommand({
    Bucket: bucket,
    Key: key,
    ResponseContentType: contentType,
  });
  return getSignedUrl(client, command, { expiresIn });
}

/**
 * @param {string} bucket
 * @param {string} region
 * @param {string} objectKey
 */
export function publicObjectHttpsUrl(bucket, region, objectKey) {
  if (!bucket || !region || !objectKey) {
    throw new Error("publicObjectHttpsUrl: missing bucket, region, or key");
  }
  const encoded = objectKey
    .split("/")
    .map((p) => encodeURIComponent(p))
    .join("/");
  return `https://${bucket}.s3.${region}.amazonaws.com/${encoded}`;
}

export { DEFAULT_PUT_EXPIRES, DEFAULT_GET_EXPIRES };
