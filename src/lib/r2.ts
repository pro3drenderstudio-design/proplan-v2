/**
 * Cloudflare R2 client (S3-compatible).
 */

import {
  S3Client, PutObjectCommand, DeleteObjectCommand,
  CreateMultipartUploadCommand, UploadPartCommand,
  CompleteMultipartUploadCommand, AbortMultipartUploadCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

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
  const buf = Buffer.isBuffer(body) ? body : Buffer.from(new Uint8Array(body as ArrayBuffer));

  // Files > 10 MB use multipart upload to avoid the 60s request timeout
  // on the single-PUT path (each 50 MB part completes well inside 60s).
  if (buf.byteLength > 10 * 1024 * 1024) {
    return uploadMultipartToR2(key, buf, contentType);
  }

  const client = getClient();
  await client.send(new PutObjectCommand({
    Bucket: BUCKET(),
    Key: key,
    Body: buf,
    ContentType: contentType,
  }));
  return `${PUBLIC()}/${key}`;
}

/** Server-side multipart upload — no presigned URLs, no client coordination. */
async function uploadMultipartToR2(key: string, buf: Buffer, contentType: string): Promise<string> {
  const client   = getClient();
  const PART_SIZE = 50 * 1024 * 1024; // 50 MB per part

  // 1. Initiate
  const init = await client.send(new CreateMultipartUploadCommand({
    Bucket: BUCKET(), Key: key, ContentType: contentType,
  }));
  const uploadId = init.UploadId!;

  // 2. Upload parts
  const parts: { PartNumber: number; ETag: string }[] = [];
  const totalParts = Math.ceil(buf.byteLength / PART_SIZE);
  try {
    for (let i = 0; i < totalParts; i++) {
      const start  = i * PART_SIZE;
      const chunk  = buf.subarray(start, start + PART_SIZE);
      const res    = await client.send(new UploadPartCommand({
        Bucket: BUCKET(), Key: key, UploadId: uploadId,
        PartNumber: i + 1, Body: chunk,
      }));
      parts.push({ PartNumber: i + 1, ETag: res.ETag! });
    }
  } catch (err) {
    await client.send(new AbortMultipartUploadCommand({ Bucket: BUCKET(), Key: key, UploadId: uploadId })).catch(() => {});
    throw err;
  }

  // 3. Complete
  await client.send(new CompleteMultipartUploadCommand({
    Bucket: BUCKET(), Key: key, UploadId: uploadId,
    MultipartUpload: { Parts: parts },
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
