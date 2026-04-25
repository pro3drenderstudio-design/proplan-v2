/**
 * POST /api/admin/compress-model
 * Parses the GLB binary format directly, compresses every embedded texture
 * with sharp (JPEG 85%, max 2048px), rebuilds the file, re-uploads to R2,
 * and updates the project record.
 *
 * No ESM packages (gltf-transform/draco) — uses only sharp + standard
 * Node buffers, so it works reliably in Next.js serverless functions.
 *
 * Mesh node names and scene structure are completely untouched.
 *
 * Body: { projectId: string }
 * Returns: { ok, originalSize, compressedSize, model_url, ... }
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { uploadToR2 } from "@/lib/r2";
import sharp from "sharp";

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

// ── GLB types ─────────────────────────────────────────────────────────────────

interface GltfBufferView {
  buffer: number;
  byteOffset: number;
  byteLength: number;
  byteStride?: number;
  target?: number;
  name?: string;
  [k: string]: unknown;
}

interface GltfImage {
  bufferView?: number;
  mimeType?: string;
  name?: string;
  uri?: string;
  [k: string]: unknown;
}

interface GltfTexture {
  source?: number;
  sampler?: number;
  name?: string;
  [k: string]: unknown;
}

interface GltfMaterial {
  pbrMetallicRoughness?: { baseColorTexture?: { index: number }; metallicRoughnessTexture?: { index: number } };
  normalTexture?:    { index: number };
  occlusionTexture?: { index: number };
  emissiveTexture?:  { index: number };
  [k: string]: unknown;
}

interface GltfJson {
  bufferViews?: GltfBufferView[];
  buffers?: Array<{ byteLength: number; uri?: string }>;
  images?: GltfImage[];
  textures?: GltfTexture[];
  materials?: GltfMaterial[];
  [k: string]: unknown;
}

// ── Core GLB parser / packer ──────────────────────────────────────────────────

function readGlb(buf: Buffer): { json: GltfJson; bin: Buffer | null } {
  if (buf.readUInt32LE(0) !== 0x46546C67) throw new Error("Not a valid GLB file (bad magic)");
  if (buf.readUInt32LE(4) !== 2) throw new Error("Only GLB version 2 is supported");

  // JSON chunk starts at byte 12
  const jsonLen  = buf.readUInt32LE(12);
  const jsonType = buf.readUInt32LE(16);
  if (jsonType !== 0x4E4F534A) throw new Error("First GLB chunk is not JSON");

  const jsonText = buf.subarray(20, 20 + jsonLen).toString("utf-8");
  const json     = JSON.parse(jsonText) as GltfJson;

  // BIN chunk (optional) follows immediately after JSON chunk
  const binOffset = 20 + jsonLen;
  let bin: Buffer | null = null;
  if (binOffset + 8 <= buf.byteLength) {
    const binLen  = buf.readUInt32LE(binOffset);
    const binType = buf.readUInt32LE(binOffset + 4);
    if (binType === 0x004E4942) {
      bin = buf.subarray(binOffset + 8, binOffset + 8 + binLen);
    }
  }

  return { json, bin };
}

function packGlb(json: GltfJson, bin: Buffer): Buffer {
  // JSON chunk — padded to 4-byte boundary with spaces (0x20)
  const jsonRaw  = Buffer.from(JSON.stringify(json), "utf-8");
  const jsonPad  = (4 - (jsonRaw.byteLength % 4)) % 4;
  const jsonChunk = Buffer.concat([jsonRaw, Buffer.alloc(jsonPad, 0x20)]);

  // BIN chunk — padded to 4-byte boundary with zeros
  const binPad   = (4 - (bin.byteLength % 4)) % 4;
  const binChunk = Buffer.concat([bin, Buffer.alloc(binPad, 0x00)]);

  const totalLen = 12 + 8 + jsonChunk.byteLength + 8 + binChunk.byteLength;

  const header = Buffer.alloc(12);
  header.writeUInt32LE(0x46546C67, 0); // magic 'glTF'
  header.writeUInt32LE(2, 4);
  header.writeUInt32LE(totalLen, 8);

  const jsonHeader = Buffer.alloc(8);
  jsonHeader.writeUInt32LE(jsonChunk.byteLength, 0);
  jsonHeader.writeUInt32LE(0x4E4F534A, 4); // 'JSON'

  const binHeader = Buffer.alloc(8);
  binHeader.writeUInt32LE(binChunk.byteLength, 0);
  binHeader.writeUInt32LE(0x004E4942, 4); // 'BIN\0'

  return Buffer.concat([header, jsonHeader, jsonChunk, binHeader, binChunk]);
}

// ── Texture compression ───────────────────────────────────────────────────────

async function compressGlbTextures(input: Buffer): Promise<Buffer> {
  const { json, bin } = readGlb(input);

  if (!bin || !json.images?.length || !json.bufferViews?.length) {
    console.log("[compress-model] no embedded textures found — returning as-is");
    return input;
  }

  // Which texture slots should stay as PNG (normal & occlusion maps use all
  // four channels with specific meaning — JPEG would corrupt them)
  const keepPngImageIndices = new Set<number>();
  const textures: GltfTexture[] = json.textures ?? [];
  for (const mat of json.materials ?? []) {
    const protect = [mat.normalTexture?.index, mat.occlusionTexture?.index];
    for (const texIdx of protect) {
      if (texIdx == null) continue;
      const src = textures[texIdx]?.source;
      if (src != null) keepPngImageIndices.add(src);
    }
  }

  // Compress each image that lives in a buffer view
  const compressed = new Map<number, { data: Buffer; mime: string }>();
  for (let i = 0; i < json.images.length; i++) {
    const img = json.images[i];
    if (img.bufferView == null) continue; // external URI image — skip

    const bv = json.bufferViews[img.bufferView];
    if (!bv) continue;

    // glTF spec: byteOffset is optional, defaults to 0
    const offset = bv.byteOffset ?? 0;
    const raw = bin.subarray(offset, offset + bv.byteLength);
    const keepPng = keepPngImageIndices.has(i);

    try {
      const pipeline = sharp(raw).resize(2048, 2048, { fit: "inside", withoutEnlargement: true });
      const data = keepPng
        ? await pipeline.png({ compressionLevel: 9 }).toBuffer()
        : await pipeline.jpeg({ quality: 85 }).toBuffer();
      compressed.set(i, { data, mime: keepPng ? "image/png" : "image/jpeg" });
    } catch (e) {
      console.warn(`[compress-model] skipping image ${i}:`, (e as Error).message);
    }
  }

  if (compressed.size === 0) return input;

  // Which buffer views are used by images
  const imageBvIndices = new Map<number /* bvIdx */, number /* imgIdx */>();
  for (let i = 0; i < json.images.length; i++) {
    const bvIdx = json.images[i].bufferView;
    if (bvIdx != null) imageBvIndices.set(bvIdx, i);
  }

  // Rebuild the BIN chunk.
  // Process in JSON index order — do NOT sort by original byteOffset because
  // byteOffset is optional (defaults to 0 per glTF spec) and undefined values
  // produce NaN comparisons that corrupt the sort.
  const chunks: Buffer[] = [];
  const newOffsets: number[] = new Array(json.bufferViews.length);
  const newLengths: number[] = new Array(json.bufferViews.length);
  let pos = 0;

  for (let bvIdx = 0; bvIdx < json.bufferViews.length; bvIdx++) {
    const bv = json.bufferViews[bvIdx];

    // Skip buffer views that reference an external buffer (buffer index ≠ 0)
    if ((bv.buffer ?? 0) !== 0) {
      newOffsets[bvIdx] = bv.byteOffset ?? 0;
      newLengths[bvIdx] = bv.byteLength;
      continue;
    }

    const imgIdx = imageBvIndices.get(bvIdx);
    const comp   = imgIdx != null ? compressed.get(imgIdx) : undefined;

    // glTF spec: byteOffset defaults to 0
    const origOffset = bv.byteOffset ?? 0;
    const data = comp
      ? comp.data
      : bin.subarray(origOffset, origOffset + bv.byteLength);

    // Align to 4 bytes between chunks
    const pad = (4 - (pos % 4)) % 4;
    if (pad > 0) { chunks.push(Buffer.alloc(pad)); pos += pad; }

    newOffsets[bvIdx] = pos;
    newLengths[bvIdx] = data.byteLength;
    chunks.push(data);
    pos += data.byteLength;
  }

  const newBin = Buffer.concat(chunks);

  // Patch JSON in-place
  for (let i = 0; i < json.bufferViews.length; i++) {
    json.bufferViews[i] = {
      ...json.bufferViews[i],
      byteOffset: newOffsets[i],
      byteLength: newLengths[i],
    };
  }

  for (let i = 0; i < json.images.length; i++) {
    const comp = compressed.get(i);
    if (comp) json.images[i] = { ...json.images[i], mimeType: comp.mime };
  }

  if (json.buffers?.[0]) {
    json.buffers[0] = { ...json.buffers[0], byteLength: newBin.byteLength };
  }

  return packGlb(json, newBin);
}

// ── Route ─────────────────────────────────────────────────────────────────────

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

  // 1. Download
  console.log("[compress-model] downloading…");
  let originalBuffer: Buffer;
  try {
    const res = await fetch(project.model_url);
    if (!res.ok) throw new Error(`fetch ${res.status}`);
    originalBuffer = Buffer.from(await res.arrayBuffer());
  } catch (err: unknown) {
    return NextResponse.json({ error: `Download failed: ${(err as Error).message}` }, { status: 502 });
  }
  const originalSize = originalBuffer.byteLength;
  console.log(`[compress-model] downloaded ${fmt(originalSize)}`);

  // 2. Compress textures
  let compressedBuffer: Buffer;
  try {
    compressedBuffer = await compressGlbTextures(originalBuffer);
  } catch (err: unknown) {
    const msg = (err as Error).message;
    console.error("[compress-model] compression error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
  const compressedSize = compressedBuffer.byteLength;
  console.log(`[compress-model] compressed ${fmt(originalSize)} → ${fmt(compressedSize)} (${Math.round((1 - compressedSize / originalSize) * 100)}% reduction)`);

  // 3. Re-upload
  const key = `models/${projectId}/model_v${Date.now()}.glb`;
  let model_url: string;
  try {
    model_url = await uploadToR2(key, compressedBuffer, "model/gltf-binary");
  } catch (err: unknown) {
    return NextResponse.json({ error: `Upload failed: ${(err as Error).message}` }, { status: 500 });
  }

  // 4. Update DB
  const { error: updateErr } = await supabase
    .from("projects")
    .update({ model_url, model_storage_path: key })
    .eq("id", projectId);
  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 });

  return NextResponse.json({
    ok: true,
    model_url,
    originalSize,
    compressedSize,
    originalFormatted:   fmt(originalSize),
    compressedFormatted: fmt(compressedSize),
    reductionPct: Math.round((1 - compressedSize / originalSize) * 100),
  });
}
