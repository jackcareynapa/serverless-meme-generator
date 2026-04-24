import { S3Client } from "@aws-sdk/client-s3";

let cached;

/**
 * @returns {S3Client}
 */
export function getS3Client() {
  if (cached) return cached;
  const region = process.env.AWS_REGION;
  if (!region) {
    throw new Error("AWS_REGION is not set");
  }
  const id = process.env.AWS_ACCESS_KEY_ID;
  const secret = process.env.AWS_SECRET_ACCESS_KEY;
  const sessionToken = process.env.AWS_SESSION_TOKEN;
  cached = new S3Client({
    region,
    credentials:
      id && secret
        ? {
            accessKeyId: id,
            secretAccessKey: secret,
            ...(sessionToken ? { sessionToken } : {}),
          }
        : undefined,
  });
  return cached;
}

export function getBucketName() {
  const b = process.env.S3_BUCKET_NAME;
  if (!b) throw new Error("S3_BUCKET_NAME is not set");
  return b;
}
