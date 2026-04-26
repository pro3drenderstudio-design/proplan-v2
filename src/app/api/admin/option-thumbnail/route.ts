import { NextRequest, NextResponse } from "next/server";
import sharp from "sharp";
import { uploadToR2 } from "@/lib/r2";

export const dynamic = "force-dynamic";

const MAX_SIZE  = 10 * 1024 * 1024; // 10 MB
const THUMB_DIM = 600;               // max px on each axis — enough for a crisp swatch

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  const optionId = formData.get("optionId") as string | null;

  if (!file)     return NextResponse.json({ error: "file is required" },    { status: 400 });
  if (!optionId) return NextResponse.json({ error: "optionId is required" },{ status: 400 });
  if (file.size > MAX_SIZE) return NextResponse.json({ error: "File exceeds 10 MB limit" }, { status: 413 });

  let uploadBytes: ArrayBuffer;
  try {
    const compressed = await sharp(Buffer.from(await file.arrayBuffer()))
      .resize(THUMB_DIM, THUMB_DIM, { fit: "cover", withoutEnlargement: true })
      .webp({ quality: 88 })
      .toBuffer();
    uploadBytes = compressed.buffer.slice(
      compressed.byteOffset,
      compressed.byteOffset + compressed.byteLength
    ) as ArrayBuffer;
  } catch (err: any) {
    console.error("option-thumbnail compression error:", err);
    return NextResponse.json({ error: "Failed to process image" }, { status: 500 });
  }

  const key = `option-thumbnails/${optionId}-${Date.now()}.webp`;

  let url: string;
  try {
    url = await uploadToR2(key, uploadBytes, "image/webp");
  } catch (err: any) {
    console.error("option-thumbnail R2 upload error:", err);
    return NextResponse.json({ error: err.message ?? "Upload failed" }, { status: 500 });
  }

  return NextResponse.json({ url });
}
