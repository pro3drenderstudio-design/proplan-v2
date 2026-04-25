/**
 * POST /api/admin/texture-upload
 * Upload a texture image to Cloudflare R2.
 * Returns the public URL.
 *
 * Body: multipart/form-data
 *   - file: image file (.jpg, .jpeg, .png, .webp, .hdr, .exr)
 *   - slot: optional label ("albedo", "normal", "roughness", etc.) used in the filename
 */

import { NextRequest, NextResponse } from "next/server";
import { uploadToR2 } from "@/lib/r2";

const ALLOWED_EXTS = [".jpg", ".jpeg", ".png", ".webp", ".hdr", ".exr", ".tga", ".bmp"];
const MAX_SIZE = 20 * 1024 * 1024; // 20 MB

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

  const key = `textures/${slot}_${Date.now()}${ext}`;
  const bytes = await file.arrayBuffer();

  let url: string;
  try {
    url = await uploadToR2(key, bytes, file.type || "application/octet-stream");
  } catch (err: any) {
    console.error("R2 texture upload error:", err);
    return NextResponse.json({ error: err.message ?? "Upload failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, url, path: key });
}
