import { NextRequest, NextResponse } from "next/server";
import { presignPutObject, getPublicUrl } from "@/lib/r2";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const { filename, contentType } = await req.json() as {
    filename:    string;
    contentType: string;
  };

  if (!filename || !contentType) {
    return NextResponse.json({ error: "filename and contentType required" }, { status: 400 });
  }

  const safeName = filename.replace(/[^a-z0-9._-]/gi, "_");
  const key      = `render-attachments/${Date.now()}-${safeName}`;

  const uploadUrl = await presignPutObject(key, contentType);
  const publicUrl = getPublicUrl(key);

  return NextResponse.json({ uploadUrl, publicUrl, key });
}
