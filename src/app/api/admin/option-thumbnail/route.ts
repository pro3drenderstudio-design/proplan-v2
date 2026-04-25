import { NextRequest, NextResponse } from "next/server";
import { uploadToR2 } from "@/lib/r2";

export const dynamic = "force-dynamic";

const MAX_SIZE = 10 * 1024 * 1024; // 10 MB

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  const optionId = formData.get("optionId") as string | null;

  if (!file) return NextResponse.json({ error: "file is required" }, { status: 400 });
  if (!optionId) return NextResponse.json({ error: "optionId is required" }, { status: 400 });
  if (file.size > MAX_SIZE) return NextResponse.json({ error: "File exceeds 10 MB limit" }, { status: 413 });

  const ext = file.name.slice(file.name.lastIndexOf(".")).toLowerCase() || ".jpg";
  const key = `option-thumbnails/${optionId}-${Date.now()}${ext}`;

  let url: string;
  try {
    url = await uploadToR2(key, await file.arrayBuffer(), file.type || "image/jpeg");
  } catch (err: any) {
    console.error("option-thumbnail R2 upload error:", err);
    return NextResponse.json({ error: err.message ?? "Upload failed" }, { status: 500 });
  }

  return NextResponse.json({ url });
}
