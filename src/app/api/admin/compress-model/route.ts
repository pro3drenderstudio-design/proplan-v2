/**
 * POST /api/admin/compress-model
 * Downloads the project's GLB from R2, runs gltf-transform optimisation
 * (texture resize/JPEG + Draco geometry compression + dedup/prune),
 * re-uploads the result, and updates the DB.
 *
 * Body: { projectId: string }
 * Returns: { ok, originalSize, compressedSize, model_url }
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { uploadToR2 } from "@/lib/r2";

export const maxDuration = 120;

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

function fmt(bytes: number) {
  if (bytes >= 1_000_000) return `${(bytes / 1_000_000).toFixed(1)} MB`;
  return `${(bytes / 1_000).toFixed(0)} KB`;
}

export async function POST(req: NextRequest) {
  const { projectId } = (await req.json()) as { projectId?: string };
  if (!projectId) return NextResponse.json({ error: "projectId required" }, { status: 400 });

  const supabase = db();
  const { data: project, error } = await supabase
    .from("projects")
    .select("id, model_url, model_storage_path")
    .eq("id", projectId)
    .single();

  if (error || !project?.model_url) {
    return NextResponse.json({ error: "Project or model not found" }, { status: 404 });
  }

  // ── 1. Download the current GLB ─────────────────────────────────────────────
  let originalBuffer: ArrayBuffer;
  try {
    const res = await fetch(project.model_url);
    if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);
    originalBuffer = await res.arrayBuffer();
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Download failed: ${msg}` }, { status: 502 });
  }

  const originalSize = originalBuffer.byteLength;

  // ── 2. Run gltf-transform pipeline (dynamic imports — ESM packages) ─────────
  let compressedBuffer: Buffer;
  try {
    // @gltf-transform/core is ESM-only — use dynamic import()
    const { NodeIO } = await import("@gltf-transform/core" as string);
    const { dedup, prune, textureCompress } = await import("@gltf-transform/functions" as string);
    const { DracoMeshCompression } = await import("@gltf-transform/extensions" as string);
    const draco3d = (await import("draco3d" as string)).default ?? (await import("draco3d" as string));
    const sharp = (await import("sharp" as string)).default ?? (await import("sharp" as string));

    const [encoderModule, decoderModule] = await Promise.all([
      draco3d.createEncoderModule({}),
      draco3d.createDecoderModule({}),
    ]);

    const io = new NodeIO()
      .registerExtensions([DracoMeshCompression])
      .registerDependencies({
        "draco3d.encoder": encoderModule,
        "draco3d.decoder": decoderModule,
      });

    const document = await io.readBinary(new Uint8Array(originalBuffer));

    await document.transform(
      // dedup: removes identical accessor/texture data — safe, never changes node names
      dedup(),
      // prune: removes unreferenced nodes/materials/textures — safe
      prune(),
      // Resize + re-encode textures to JPEG 2048px max.
      // Textures with alpha (e.g. opacity maps) are kept as PNG to avoid artefacts.
      textureCompress({
        encoder: sharp,
        targetFormat: "jpeg",
        resize: [2048, 2048],
        quality: 85,
        slots: /^(?!normalTexture|occlusionTexture).*$/,
      }),
      // Draco: compresses geometry data only — mesh names and node structure are preserved
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (await import("@gltf-transform/functions" as string)).draco({ quantizationBits: { POSITION: 14, NORMAL: 10, TEX_COORD: 12, COLOR: 8, GENERIC: 12 } } as any),
      // NOTE: flatten() and join() are intentionally excluded.
      // join() merges meshes by material, which would destroy the named node
      // structure that scene-editor option mappings depend on.
    );

    const out = await io.writeBinary(document);
    compressedBuffer = Buffer.from(out);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[compress-model] transform error:", msg);
    return NextResponse.json({ error: `Compression failed: ${msg}` }, { status: 500 });
  }

  const compressedSize = compressedBuffer.byteLength;

  // ── 3. Re-upload to R2 ───────────────────────────────────────────────────────
  const key = `models/${projectId}/model_v${Date.now()}.glb`;
  let model_url: string;
  try {
    model_url = await uploadToR2(key, compressedBuffer, "model/gltf-binary");
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Upload failed: ${msg}` }, { status: 500 });
  }

  // ── 4. Update DB ─────────────────────────────────────────────────────────────
  const { error: updateErr } = await supabase
    .from("projects")
    .update({ model_url, model_storage_path: key })
    .eq("id", projectId);

  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 500 });
  }

  console.log(`[compress-model] ${projectId}: ${fmt(originalSize)} → ${fmt(compressedSize)} (${Math.round((1 - compressedSize / originalSize) * 100)}% reduction)`);

  return NextResponse.json({
    ok: true,
    model_url,
    originalSize,
    compressedSize,
    originalFormatted: fmt(originalSize),
    compressedFormatted: fmt(compressedSize),
    reductionPct: Math.round((1 - compressedSize / originalSize) * 100),
  });
}
