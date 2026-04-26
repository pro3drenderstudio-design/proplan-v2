/**
 * POST /api/models/multipart/complete
 * Finalises a multipart upload and updates the project record.
 * Body: { projectId, key, uploadId, parts: { PartNumber, ETag }[] }
 * Returns: { model_url, model_storage_path }
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { completeMultipartUpload, abortMultipartUpload } from "@/lib/r2";

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

export async function POST(req: NextRequest) {
  const { projectId, key, uploadId, parts } = (await req.json()) as {
    projectId?: string;
    key?: string;
    uploadId?: string;
    parts?: { PartNumber: number; ETag: string }[];
  };

  if (!projectId || !key || !uploadId || !parts?.length) {
    return NextResponse.json({ error: "projectId, key, uploadId, and parts required" }, { status: 400 });
  }

  let modelUrl: string;
  try {
    modelUrl = await completeMultipartUpload(key, uploadId, parts);
  } catch (err: any) {
    await abortMultipartUpload(key, uploadId);
    return NextResponse.json({ error: err.message ?? "Failed to complete upload" }, { status: 500 });
  }

  const { error: updateErr } = await db()
    .from("projects")
    .update({ model_url: modelUrl, model_storage_path: key })
    .eq("id", projectId);

  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, model_url: modelUrl, model_storage_path: key });
}
