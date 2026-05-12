import { NextRequest, NextResponse } from "next/server";
import { uploadToR2 } from "@/lib/r2";

const ALLOWED_TYPES = [
  "application/pdf",
  "image/jpeg", "image/jpg", "image/png", "image/webp", "image/tiff",
];
const MAX_SIZE = 30 * 1024 * 1024; // 30 MB

export async function POST(req: NextRequest) {
  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  const file = formData.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });

  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json({ error: "Only PDF and image files are accepted" }, { status: 415 });
  }
  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: "File exceeds 30 MB limit" }, { status: 413 });
  }

  const ext      = file.name.split(".").pop()?.toLowerCase() ?? "bin";
  const key      = `site-map-files/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  const bytes    = Buffer.from(await file.arrayBuffer());

  const url = await uploadToR2(key, bytes, file.type);
  return NextResponse.json({ url, name: file.name, size: file.size });
}
