/**
 * POST /api/models/multipart/initiate
 * Starts a multipart upload for a large GLB.
 * Body: { projectId: string }
 * Returns: { uploadId, key, publicUrl (final URL once complete) }
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createMultipartUpload, deleteFromR2 } from "@/lib/r2";

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

export async function POST(req: NextRequest) {
  const { projectId } = (await req.json()) as { projectId?: string };
  if (!projectId) return NextResponse.json({ error: "projectId required" }, { status: 400 });

  const supabase = db();
  const { data: project, error } = await supabase
    .from("projects")
    .select("id, model_storage_path")
    .eq("id", projectId)
    .single();

  if (error || !project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

  if (project.model_storage_path) {
    await deleteFromR2(project.model_storage_path).catch(() => {});
  }

  const key = `models/${projectId}/model_v${Date.now()}.glb`;
  let uploadId: string;
  try {
    uploadId = await createMultipartUpload(key, "model/gltf-binary");
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? "Failed to initiate upload" }, { status: 500 });
  }

  return NextResponse.json({ uploadId, key });
}
