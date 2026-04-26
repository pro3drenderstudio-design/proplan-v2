/**
 * POST /api/models/upload
 * Accepts a GLB file, stores it in Cloudflare R2,
 * updates projects.model_url + projects.model_storage_path,
 * and returns the public URL.
 *
 * Body: multipart/form-data
 *   - file: the .glb file
 *   - projectId: UUID of the project
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { uploadToR2, deleteFromR2 } from "@/lib/r2";

function supabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100 MB (larger files use multipart)

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  const projectId = formData.get("projectId") as string | null;

  if (!file || !projectId) {
    return NextResponse.json({ error: "file and projectId are required" }, { status: 400 });
  }

  if (!file.name.toLowerCase().endsWith(".glb")) {
    return NextResponse.json({ error: "Only .glb files are accepted" }, { status: 400 });
  }

  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json({ error: "File exceeds 200 MB limit" }, { status: 413 });
  }

  const db = supabase();

  const { data: project, error: projErr } = await db
    .from("projects")
    .select("id, model_storage_path")
    .eq("id", projectId)
    .single();

  if (projErr || !project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  // Delete previous model from R2 if one exists
  if (project.model_storage_path) {
    await deleteFromR2(project.model_storage_path).catch(() => {});
  }

  const key = `models/${projectId}/model_v${Date.now()}.glb`;
  const bytes = await file.arrayBuffer();

  console.log("[R2] env check — ACCOUNT_ID:", process.env.R2_ACCOUNT_ID ? "set" : "MISSING",
    "| KEY:", process.env.R2_ACCESS_KEY_ID ? "set" : "MISSING",
    "| SECRET:", process.env.R2_SECRET_ACCESS_KEY ? "set" : "MISSING",
    "| BUCKET:", process.env.R2_BUCKET_NAME ?? "MISSING",
    "| PUBLIC_URL:", process.env.R2_PUBLIC_URL ?? "MISSING");

  let modelUrl: string;
  try {
    modelUrl = await uploadToR2(key, bytes, "model/gltf-binary");
  } catch (err: any) {
    console.error("[R2] GLB upload error:", err?.message, err?.cause);
    return NextResponse.json({ error: err.message ?? "Upload failed" }, { status: 500 });
  }

  const { error: updateErr } = await db
    .from("projects")
    .update({ model_url: modelUrl, model_storage_path: key })
    .eq("id", projectId);

  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, model_url: modelUrl, model_storage_path: key });
}
