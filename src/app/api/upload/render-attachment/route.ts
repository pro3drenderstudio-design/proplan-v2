import { NextRequest, NextResponse } from "next/server";
import { uploadToR2 } from "@/lib/r2";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const file = formData.get("file") as File | null;

  if (!file) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  const safeName = file.name.replace(/[^a-z0-9._-]/gi, "_");
  const key      = `render-attachments/${Date.now()}-${safeName}`;
  const buffer   = Buffer.from(await file.arrayBuffer());

  let url: string;
  try {
    url = await uploadToR2(key, buffer, file.type || "application/octet-stream");
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("render-attachment R2 upload error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  return NextResponse.json({
    url,
    name: file.name,
    type: file.type || "application/octet-stream",
    size: file.size,
  });
}
