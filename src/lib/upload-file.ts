"use client";

export interface UploadedFile {
  url:  string;
  name: string;
  type: string;
  size: number;
}

// Files under 4 MB go through the Vercel function (simpler).
// Files at or above 4 MB use a presigned PUT direct to R2 to stay
// well under Vercel's 4.5 MB serverless body limit.
const DIRECT_LIMIT = 4 * 1024 * 1024;

export async function uploadFile(file: File): Promise<UploadedFile> {
  if (file.size < DIRECT_LIMIT) {
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch("/api/upload/render-attachment", { method: "POST", body: fd });
    if (!res.ok) {
      const err = await res.json().catch(() => ({})) as { error?: string };
      throw new Error(err.error ?? `Upload failed (HTTP ${res.status})`);
    }
    return res.json() as Promise<UploadedFile>;
  }

  // Large file: get a presigned PUT URL and upload directly to R2
  const presignRes = await fetch("/api/upload/presign-render-attachment", {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({ filename: file.name, contentType: file.type || "application/octet-stream" }),
  });
  if (!presignRes.ok) {
    throw new Error("Failed to get upload URL");
  }
  const { uploadUrl, publicUrl } = await presignRes.json() as {
    uploadUrl: string;
    publicUrl: string;
  };

  const putRes = await fetch(uploadUrl, {
    method:  "PUT",
    headers: { "Content-Type": file.type || "application/octet-stream" },
    body:    file,
  });
  if (!putRes.ok) {
    throw new Error(`Direct upload failed (HTTP ${putRes.status})`);
  }

  return { url: publicUrl, name: file.name, type: file.type || "application/octet-stream", size: file.size };
}

export async function uploadFiles(files: File[]): Promise<{ valid: UploadedFile[]; errors: string[] }> {
  const results = await Promise.all(
    files.map(f => uploadFile(f).then(r => ({ ok: true as const, r })).catch(e => ({ ok: false as const, msg: String(e) })))
  );
  return {
    valid:  results.filter(r => r.ok).map(r => (r as { ok: true; r: UploadedFile }).r),
    errors: results.filter(r => !r.ok).map(r => (r as { ok: false; msg: string }).msg),
  };
}
