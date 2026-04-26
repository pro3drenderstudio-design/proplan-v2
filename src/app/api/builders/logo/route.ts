import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";
import { uploadToR2 } from "@/lib/r2";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

const MAX_SIZE = 10 * 1024 * 1024; // 10 MB
const MAX_DIM  = 600;              // logos don't need to be huge

export async function POST(req: NextRequest) {
  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  const file      = formData.get("file")       as File   | null;
  const builderId = formData.get("builder_id") as string | null;

  if (!file) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }
  if (!file.type.startsWith("image/")) {
    return NextResponse.json({ error: "File must be an image" }, { status: 400 });
  }
  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: "File exceeds 10 MB limit" }, { status: 413 });
  }

  let uploadBytes: Buffer;
  try {
    uploadBytes = await sharp(Buffer.from(await file.arrayBuffer()))
      .resize(MAX_DIM, MAX_DIM, { fit: "inside", withoutEnlargement: true })
      .webp({ quality: 92 })
      .toBuffer();
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Image processing failed: ${msg}` }, { status: 500 });
  }

  const key = `builder-logos/${Date.now()}-${Math.random().toString(36).slice(2)}.webp`;

  let publicUrl: string;
  try {
    publicUrl = await uploadToR2(key, uploadBytes, "image/webp");
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("Logo R2 upload error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  if (builderId) {
    const { error: dbError } = await supabase
      .from("builders")
      .update({ logo_url: publicUrl, updated_at: new Date().toISOString() })
      .eq("id", builderId);

    if (dbError) console.error("Logo DB update error:", dbError.message);
  }

  return NextResponse.json({ url: publicUrl });
}
