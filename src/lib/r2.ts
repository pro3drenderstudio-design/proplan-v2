/**
 * Cloudflare R2 client (S3-compatible).
 * Uses the fetch-based HTTP handler to avoid Windows Node.js TLS issues.
 */

import {
  S3Client, PutObjectCommand, DeleteObjectCommand,
  CreateMultipartUploadCommand, UploadPartCommand,
  CompleteMultipartUploadCommand, AbortMultipartUploadCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { FetchHttpHandler } from "@smithy/fetch-http-handler";

function getClient() {
  const accountId = process.env.R2_ACCOUNT_ID;
  if (!accountId) throw new Error("R2_ACCOUNT_ID env var is not set");

  return new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId:     process.env.R2_ACCESS_KEY_ID!,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
    },
    forcePathStyle: false,
    requestHandler: new FetchHttpHandler({ requestTimeout: 60_000 }),
  });
}

const BUCKET = () => {
  const b = process.env.R2_BUCKET_NAME;
  if (!b) throw new Error("R2_BUCKET_NAME env var is not set");
  return b;
};

const PUBLIC = () => {
  const u = process.env.R2_PUBLIC_URL;
  if (!u) throw new Error("R2_PUBLIC_URL env var is not set");
  return u.replace(/\/$/, "");
};

export async function uploadToR2(
  key: string,
  body: Buffer | ArrayBuffer,
  contentType: string,
): Promise<string> {
  const client = getClient();
  await client.send(new PutObjectCommand({
    Bucket: BUCKET(),
    Key: key,
    Body: Buffer.isBuffer(body) ? body : Buffer.from(new Uint8Array(body as ArrayBuffer)),
    ContentType: contentType,
  }));
  return `${PUBLIC()}/${key}`;
}

export async function deleteFromR2(key: string): Promise<void> {
  const client = getClient();
  await client.send(new DeleteObjectCommand({ Bucket: BUCKET(), Key: key })).catch(() => {});
}

// ── Multipart upload helpers ──────────────────────────────────────────────────

export async function createMultipartUpload(key: string, contentType: string): Promise<string> {
  const client = getClient();
  const res = await client.send(new CreateMultipartUploadCommand({
    Bucket: BUCKET(), Key: key, ContentType: contentType,
  }));
  if (!res.UploadId) throw new Error("No UploadId returned");
  return res.UploadId;
}

export async function presignUploadPart(key: string, uploadId: string, partNumber: number): Promise<string> {
  const client = getClient();
  const cmd = new UploadPartCommand({ Bucket: BUCKET(), Key: key, UploadId: uploadId, PartNumber: partNumber });
  return getSignedUrl(client, cmd, { expiresIn: 3600 });
}

export async function completeMultipartUpload(
  key: string,
  uploadId: string,
  parts: { PartNumber: number; ETag: string }[],
): Promise<string> {
  const client = getClient();
  await client.send(new CompleteMultipartUploadCommand({
    Bucket: BUCKET(), Key: key, UploadId: uploadId,
    MultipartUpload: { Parts: parts },
  }));
  return `${PUBLIC()}/${key}`;
}

export async function abortMultipartUpload(key: string, uploadId: string): Promise<void> {
  const client = getClient();
  await client.send(new AbortMultipartUploadCommand({ Bucket: BUCKET(), Key: key, UploadId: uploadId })).catch(() => {});
}
