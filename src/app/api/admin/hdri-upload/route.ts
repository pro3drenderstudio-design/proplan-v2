import { NextRequest, NextResponse } from "next/server";
import { uploadToR2 } from "@/lib/r2";

const ALLOWED_EXT = [".hdr", ".exr"];
const MAX_SIZE = 50 * 1024 * 1024; // 50 MB

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const file = formData.get("file") as File | null;

  if (!file) return NextResponse.json({ error: "file required" }, { status: 400 });

  const ext = file.name.toLowerCase().match(/\.\w+$/)?.[0] ?? "";
  if (!ALLOWED_EXT.includes(ext))
    return NextResponse.json({ error: "Only .hdr or .exr files accepted" }, { status: 400 });

  if (file.size > MAX_SIZE)
    return NextResponse.json({ error: "File exceeds 50 MB limit" }, { status: 413 });

  const key = `hdri/${Date.now()}${ext}`;
  const bytes = await file.arrayBuffer();

  let url: string;
  try {
    url = await uploadToR2(key, bytes, "application/octet-stream");
  } catch (err: any) {
    console.error("R2 HDRI upload error:", err);
    return NextResponse.json({ error: err.message ?? "Upload failed" }, { status: 500 });
  }

  return NextResponse.json({ url });
}
