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

  // ── 2. Run gltf-transform pipeline ──────────────────────────────────────────
  let compressedBuffer: Buffer;
  try {
    // Step A — load modules (log each so we can see exactly where it fails)
    console.log("[compress-model] importing @gltf-transform/core…");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { NodeIO } = await import("@gltf-transform/core") as any;

    console.log("[compress-model] importing @gltf-transform/functions…");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fns = await import("@gltf-transform/functions") as any;
    const { dedup, prune, textureCompress, draco } = fns;

    console.log("[compress-model] importing @gltf-transform/extensions…");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { DracoMeshCompression } = await import("@gltf-transform/extensions") as any;

    console.log("[compress-model] importing draco3d…");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const draco3dMod = await import("draco3d") as any;
    const draco3d = draco3dMod.default ?? draco3dMod;

    console.log("[compress-model] importing sharp…");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sharpMod = await import("sharp") as any;
    const sharp = sharpMod.default ?? sharpMod;

    // Step B — initialise Draco WASM encoder/decoder
    console.log("[compress-model] initialising Draco WASM…");
    const [encoderModule, decoderModule] = await Promise.all([
      draco3d.createEncoderModule({}),
      draco3d.createDecoderModule({}),
    ]);

    // Step C — read GLB
    console.log("[compress-model] reading GLB…");
    const io = new NodeIO()
      .registerExtensions([DracoMeshCompression])
      .registerDependencies({
        "draco3d.encoder": encoderModule,
        "draco3d.decoder": decoderModule,
      });
    const document = await io.readBinary(new Uint8Array(originalBuffer));

    // Step D — transform pipeline
    console.log("[compress-model] running transform pipeline…");
    await document.transform(
      dedup(),
      prune(),
      // Resize textures to max 2048px and convert to JPEG 85%.
      // Normal/occlusion maps stay as PNG to preserve their data channels.
      textureCompress({
        encoder: sharp,
        targetFormat: "jpeg",
        resize: [2048, 2048],
        quality: 85,
        slots: /^(?!normalTexture|occlusionTexture).*$/,
      }),
      // Draco compresses vertex/index buffers only — mesh names unchanged
      draco({
        quantizationBits: { POSITION: 14, NORMAL: 10, TEX_COORD: 12, COLOR: 8, GENERIC: 12 },
      }),
    );

    // Step E — serialise
    console.log("[compress-model] serialising…");
    const out = await io.writeBinary(document);
    compressedBuffer = Buffer.from(out);
    console.log("[compress-model] pipeline complete");
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? err.stack : "";
    console.error("[compress-model] FAILED:", msg, stack);
    return NextResponse.json({ error: msg }, { status: 500 });
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
