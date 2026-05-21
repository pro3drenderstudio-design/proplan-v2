import { NextRequest, NextResponse } from "next/server";
import sharp from "sharp";
import { uploadToR2 } from "@/lib/r2";

const MAX_SIZE = 10 * 1024 * 1024; // 10 MB

export async function POST(req: NextRequest) {
  let formData: FormData;
  try { formData = await req.formData(); }
  catch { return NextResponse.json({ error: "Invalid form data" }, { status: 400 }); }

  const file      = formData.get("file") as File | null;
  const pathParam = formData.get("path") as string | null;

  if (!file)      return NextResponse.json({ error: "No file" }, { status: 400 });
  if (!pathParam) return NextResponse.json({ error: "No path" }, { status: 400 });
  if (!file.type.startsWith("image/")) return NextResponse.json({ error: "Must be an image" }, { status: 400 });
  if (file.size > MAX_SIZE) return NextResponse.json({ error: "File exceeds 10 MB limit" }, { status: 413 });

  let uploadBytes: Buffer;
  try {
    uploadBytes = await sharp(Buffer.from(await file.arrayBuffer()))
      .resize(1600, 1600, { fit: "inside", withoutEnlargement: true })
      .webp({ quality: 90 })
      .toBuffer();
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Image processing failed: ${msg}` }, { status: 500 });
  }

  // Strip existing extension and add .webp
  const key = pathParam.replace(/\.[^./]+$/, "") + ".webp";

  try {
    const url = await uploadToR2(key, uploadBytes, "image/webp");
    return NextResponse.json({ url });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
