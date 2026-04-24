import { GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { getS3Client, getBucketName } from "./client.js";

/**
 * @param {string} key
 * @param {string} body
 * @param {string} contentType
 */
export async function putObjectBuffer(key, body, contentType) {
  const client = getS3Client();
  const bucket = getBucketName();
  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
    })
  );
}

/**
 * @param {string} key
 * @param {string} json
 */
export async function putObjectJson(key, json) {
  await putObjectBuffer(key, json, "application/json; charset=utf-8");
}

/**
 * @param {string} key
 * @returns {Promise<string>}
 */
export async function getObjectText(key) {
  const client = getS3Client();
  const bucket = getBucketName();
  const out = await client.send(
    new GetObjectCommand({ Bucket: bucket, Key: key })
  );
  if (!out.Body) throw new Error("Empty S3 object body");
  return out.Body.transformToString();
}
