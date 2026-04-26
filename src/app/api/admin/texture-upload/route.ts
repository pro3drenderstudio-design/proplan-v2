/**
 * POST /api/admin/texture-upload
 * Upload a texture image to Cloudflare R2.
 * Standard bitmap formats (jpg/png/webp/bmp/tga) are resized to ≤2048px
 * on either dimension and re-encoded as WebP before upload.
 * HDR/EXR are passed through unchanged (sharp cannot process them).
 *
 * Body: multipart/form-data
 *   - file: image file (.jpg, .jpeg, .png, .webp, .hdr, .exr, .tga, .bmp)
 *   - slot: optional label ("albedo", "normal", "roughness", etc.) used in the filename
 */

import { NextRequest, NextResponse } from "next/server";
import sharp from "sharp";
import { uploadToR2 } from "@/lib/r2";

const ALLOWED_EXTS = [".jpg", ".jpeg", ".png", ".webp", ".hdr", ".exr", ".tga", ".bmp"];
// HDR/EXR are floating-point formats — sharp cannot process them, so pass through raw.
const PASSTHROUGH_EXTS = new Set([".hdr", ".exr"]);
const MAX_SIZE = 50 * 1024 * 1024; // 50 MB
const MAX_DIM  = 2048;

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  const slot = (formData.get("slot") as string | null) ?? "tex";

  if (!file) return NextResponse.json({ error: "file is required" }, { status: 400 });

  const ext = file.name.slice(file.name.lastIndexOf(".")).toLowerCase();
  if (!ALLOWED_EXTS.includes(ext)) {
    return NextResponse.json({ error: `Unsupported file type: ${ext}` }, { status: 400 });
  }
  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: "File exceeds 20 MB limit" }, { status: 413 });
  }

  const rawBytes = await file.arrayBuffer();

  let uploadBytes: ArrayBuffer;
  let contentType: string;
  let storageExt: string;

  if (PASSTHROUGH_EXTS.has(ext)) {
    // HDR/EXR — no conversion
    uploadBytes = rawBytes;
    contentType = file.type || "application/octet-stream";
    storageExt  = ext;
  } else {
    // Resize to ≤2048px on each axis, convert to WebP
    try {
      const compressed = await sharp(Buffer.from(rawBytes))
        .resize(MAX_DIM, MAX_DIM, { fit: "inside", withoutEnlargement: true })
        .webp({ quality: 85 })
        .toBuffer();
      uploadBytes = compressed.buffer.slice(
        compressed.byteOffset,
        compressed.byteOffset + compressed.byteLength
      ) as ArrayBuffer;
      contentType = "image/webp";
      storageExt  = ".webp";
    } catch (err: any) {
      console.error("Texture compression error:", err);
      return NextResponse.json({ error: "Failed to process image" }, { status: 500 });
    }
  }

  const key = `textures/${slot}_${Date.now()}${storageExt}`;

  let url: string;
  try {
    url = await uploadToR2(key, uploadBytes, contentType);
  } catch (err: any) {
    console.error("R2 texture upload error:", err);
    return NextResponse.json({ error: err.message ?? "Upload failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, url, path: key });
}
