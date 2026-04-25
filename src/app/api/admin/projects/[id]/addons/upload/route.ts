/**
 * POST /api/admin/projects/[id]/addons/upload
 * Uploads an addon GLB to R2 and returns the public URL + storage key.
 * Does NOT modify the project record — caller saves the addon into camera_defaults._addons.
 *
 * Body: multipart/form-data
 *   - file: the .glb file
 *   - addonId: client-generated UUID for this addon
 */

import { NextRequest, NextResponse } from "next/server";
import { uploadToR2 } from "@/lib/r2";

const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100 MB

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: projectId } = await params;
  const formData = await req.formData();
  const file    = formData.get("file")    as File   | null;
  const addonId = formData.get("addonId") as string | null;

  if (!file || !addonId) {
    return NextResponse.json({ error: "file and addonId are required" }, { status: 400 });
  }
  if (!file.name.toLowerCase().endsWith(".glb")) {
    return NextResponse.json({ error: "Only .glb files are accepted" }, { status: 400 });
  }
  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json({ error: "File exceeds 100 MB — use multipart upload" }, { status: 413 });
  }

  const key   = `models/${projectId}/addon_${addonId}_${Date.now()}.glb`;
  const bytes = await file.arrayBuffer();

  let modelUrl: string;
  try {
    modelUrl = await uploadToR2(key, bytes, "model/gltf-binary");
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  return NextResponse.json({ ok: true, modelUrl, storagePath: key });
}
