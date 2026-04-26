/**
 * POST /api/models/multipart/presign
 * Returns a presigned URL for one upload part.
 * Body: { key: string; uploadId: string; partNumber: number }
 * Returns: { url: string }
 */

import { NextRequest, NextResponse } from "next/server";
import { presignUploadPart } from "@/lib/r2";

export async function POST(req: NextRequest) {
  const { key, uploadId, partNumber } = (await req.json()) as {
    key?: string; uploadId?: string; partNumber?: number;
  };

  if (!key || !uploadId || !partNumber) {
    return NextResponse.json({ error: "key, uploadId, and partNumber required" }, { status: 400 });
  }

  if (partNumber < 1 || partNumber > 10000) {
    return NextResponse.json({ error: "partNumber must be 1–10000" }, { status: 400 });
  }

  let url: string;
  try {
    url = await presignUploadPart(key, uploadId, partNumber);
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? "Failed to generate presigned URL" }, { status: 500 });
  }

  return NextResponse.json({ url });
}
