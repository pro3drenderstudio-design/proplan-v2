/**
 * POST /api/admin/projects/[id]/addons/bake
 * Merges the base model + all addon GLBs into a single GLB, uploads it,
 * and returns the new model_url + storage_path.
 * The caller must clear _addons from camera_defaults and update the project record.
 *
 * Body: { addons: ProjectAddon[] }
 *   where each addon has modelUrl + transform (position, rotation, scale)
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { uploadToR2 } from "@/lib/r2";
import * as THREE from "three";

export const maxDuration = 120;

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

// ── Minimal GLB types ────────────────────────────────────────────────────────

interface GltfBufView { buffer: number; byteOffset?: number; byteLength: number; byteStride?: number; target?: number; [k: string]: unknown }
interface GltfAccessor { bufferView?: number; byteOffset?: number; componentType: number; count: number; type: string; [k: string]: unknown }
interface GltfMesh { primitives: Array<{ attributes: Record<string, number>; indices?: number; material?: number; [k: string]: unknown }>; name?: string; [k: string]: unknown }
interface GltfNode { mesh?: number; children?: number[]; name?: string; translation?: number[]; rotation?: number[]; scale?: number[]; matrix?: number[]; [k: string]: unknown }
interface GltfScene { nodes?: number[]; name?: string; [k: string]: unknown }
interface GltfSkin { joints: number[]; [k: string]: unknown }
interface GltfImage { bufferView?: number; mimeType?: string; uri?: string; [k: string]: unknown }
interface GltfTexture { source?: number; sampler?: number; [k: string]: unknown }
interface GltfMaterial { [k: string]: unknown }
interface GltfJson {
  asset: { version: string; generator?: string };
  scene?: number;
  scenes?: GltfScene[];
  nodes?: GltfNode[];
  meshes?: GltfMesh[];
  accessors?: GltfAccessor[];
  bufferViews?: GltfBufView[];
  buffers?: Array<{ byteLength: number; uri?: string }>;
  images?: GltfImage[];
  textures?: GltfTexture[];
  materials?: GltfMaterial[];
  skins?: GltfSkin[];
  [k: string]: unknown;
}

// ── Parse / pack ─────────────────────────────────────────────────────────────

function readGlb(buf: Buffer): { json: GltfJson; bin: Buffer } {
  if (buf.readUInt32LE(0) !== 0x46546C67) throw new Error("Not a GLB file");
  const jsonLen = buf.readUInt32LE(12);
  const json = JSON.parse(buf.subarray(20, 20 + jsonLen).toString("utf-8")) as GltfJson;
  const binOff = 20 + jsonLen;
  const bin = (binOff + 8 <= buf.byteLength && buf.readUInt32LE(binOff + 4) === 0x004E4942)
    ? buf.subarray(binOff + 8, binOff + 8 + buf.readUInt32LE(binOff))
    : Buffer.alloc(0);
  return { json, bin };
}

function packGlb(json: GltfJson, bin: Buffer): Buffer {
  const jr = Buffer.from(JSON.stringify(json), "utf-8");
  const jp = (4 - (jr.byteLength % 4)) % 4;
  const bp = (4 - (bin.byteLength % 4)) % 4;
  const jc = Buffer.concat([jr, Buffer.alloc(jp, 0x20)]);
  const bc = Buffer.concat([bin, Buffer.alloc(bp, 0x00)]);
  const total = 12 + 8 + jc.byteLength + 8 + bc.byteLength;
  const hdr = Buffer.alloc(12); hdr.writeUInt32LE(0x46546C67, 0); hdr.writeUInt32LE(2, 4); hdr.writeUInt32LE(total, 8);
  const jh = Buffer.alloc(8); jh.writeUInt32LE(jc.byteLength, 0); jh.writeUInt32LE(0x4E4F534A, 4);
  const bh = Buffer.alloc(8); bh.writeUInt32LE(bc.byteLength, 0); bh.writeUInt32LE(0x004E4942, 4);
  return Buffer.concat([hdr, jh, jc, bh, bc]);
}

// ── Merge N GLBs into one ────────────────────────────────────────────────────

interface AddonInput {
  modelUrl: string;
  name: string;
  transform: { position: [number,number,number]; rotation: [number,number,number]; scale: [number,number,number] };
}

async function fetchGlb(url: string): Promise<Buffer> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

function eulerToQuat(rx: number, ry: number, rz: number): [number, number, number, number] {
  const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz, "XYZ"));
  return [q.x, q.y, q.z, q.w];
}

function mergeGlbs(base: { json: GltfJson; bin: Buffer }, addons: Array<{ json: GltfJson; bin: Buffer; addon: AddonInput }>): Buffer {
  // We'll build a new merged JSON + BIN.
  // Strategy:
  // 1. Copy base as-is (bufferViews, accessors, meshes, nodes, images, textures, materials all keep their indices).
  // 2. For each addon, offset all its index references by the base counts, then append.
  // 3. Create a wrapper node for each addon at its transform position.
  // 4. Add all wrapper nodes to the base scene.

  const merged: GltfJson = {
    asset: { version: "2.0", generator: "ProPlan Bake" },
    scene: 0,
    scenes: [{ nodes: [...(base.json.scenes?.[base.json.scene ?? 0]?.nodes ?? [])] }],
    nodes:      [...(base.json.nodes      ?? [])],
    meshes:     [...(base.json.meshes     ?? [])],
    accessors:  [...(base.json.accessors  ?? [])],
    bufferViews:[...(base.json.bufferViews ?? [])],
    buffers:    [{ byteLength: 0 }],
    images:     [...(base.json.images     ?? [])],
    textures:   [...(base.json.textures   ?? [])],
    materials:  [...(base.json.materials  ?? [])],
  };

  // BIN chunks — base first, then addons
  const chunks: Buffer[] = [];
  let pos = 0;

  function appendBin(data: Buffer): number {
    const pad = (4 - (pos % 4)) % 4;
    if (pad) { chunks.push(Buffer.alloc(pad)); pos += pad; }
    const off = pos;
    chunks.push(data);
    pos += data.byteLength;
    return off;
  }

  // Remap base buffer views to new offsets
  const baseBvOffsets: number[] = [];
  for (const bv of (base.json.bufferViews ?? [])) {
    const origOff = bv.byteOffset ?? 0;
    const data = base.bin.subarray(origOff, origOff + bv.byteLength);
    baseBvOffsets.push(appendBin(data));
  }
  merged.bufferViews = (base.json.bufferViews ?? []).map((bv, i) => ({
    ...bv, buffer: 0, byteOffset: baseBvOffsets[i],
  }));

  // Process each addon
  for (const { json: aj, bin: ab, addon } of addons) {
    const nodeOffset      = merged.nodes!.length;
    const meshOffset      = merged.meshes!.length;
    const accessorOffset  = merged.accessors!.length;
    const bvOffset        = merged.bufferViews!.length;
    const imageOffset     = merged.images!.length;
    const textureOffset   = merged.textures!.length;
    const materialOffset  = merged.materials!.length;

    // Remap addon buffer views
    const addonBvOffsets: number[] = [];
    for (const bv of (aj.bufferViews ?? [])) {
      if ((bv.buffer ?? 0) !== 0) { addonBvOffsets.push(bv.byteOffset ?? 0); continue; }
      const origOff = bv.byteOffset ?? 0;
      const data = ab.subarray(origOff, origOff + bv.byteLength);
      addonBvOffsets.push(appendBin(data));
    }

    // Remap accessor bufferView references
    for (const acc of (aj.accessors ?? [])) {
      const remapped = { ...acc };
      if (remapped.bufferView != null) remapped.bufferView = remapped.bufferView + bvOffset;
      merged.accessors!.push(remapped);
    }

    // Remap bufferViews (add to merged)
    for (let i = 0; i < (aj.bufferViews ?? []).length; i++) {
      merged.bufferViews!.push({ ...aj.bufferViews![i], buffer: 0, byteOffset: addonBvOffsets[i] });
    }

    // Remap images
    for (const img of (aj.images ?? [])) {
      const remapped = { ...img };
      if (remapped.bufferView != null) remapped.bufferView = remapped.bufferView + bvOffset;
      merged.images!.push(remapped);
    }

    // Remap textures
    for (const tex of (aj.textures ?? [])) {
      const remapped = { ...tex };
      if (remapped.source != null) remapped.source = remapped.source + imageOffset;
      merged.textures!.push(remapped);
    }

    // Remap materials (texture refs)
    for (const mat of (aj.materials ?? [])) {
      const remapped = JSON.parse(JSON.stringify(mat)) as GltfMaterial;
      // Walk all texture index references in material JSON
      function remapTexIdx(obj: unknown) {
        if (!obj || typeof obj !== "object") return;
        for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
          if (k === "index" && typeof v === "number") (obj as Record<string, unknown>)[k] = v + textureOffset;
          else remapTexIdx(v);
        }
      }
      remapTexIdx(remapped);
      merged.materials!.push(remapped);
    }

    // Remap meshes (accessor + material refs)
    for (const mesh of (aj.meshes ?? [])) {
      const remapped: GltfMesh = {
        ...mesh,
        primitives: mesh.primitives.map(prim => ({
          ...prim,
          attributes: Object.fromEntries(
            Object.entries(prim.attributes).map(([k, v]) => [k, v + accessorOffset])
          ),
          ...(prim.indices != null ? { indices: prim.indices + accessorOffset } : {}),
          ...(prim.material != null ? { material: prim.material + materialOffset } : {}),
        })),
      };
      merged.meshes!.push(remapped);
    }

    // Remap nodes (mesh + children refs)
    const addonNodes: GltfNode[] = (aj.nodes ?? []).map(n => ({
      ...n,
      ...(n.mesh     != null ? { mesh:     n.mesh     + meshOffset    } : {}),
      ...(n.children ? { children: n.children.map(c => c + nodeOffset) } : {}),
    }));
    merged.nodes!.push(...addonNodes);

    // Create a wrapper node at the addon's transform
    const [px, py, pz] = addon.transform.position;
    const [rx, ry, rz] = addon.transform.rotation;
    const [sx, sy, sz] = addon.transform.scale;
    const quat = eulerToQuat(rx, ry, rz);

    // Find the addon scene's root nodes
    const addonRootNodes = (aj.scenes?.[aj.scene ?? 0]?.nodes ?? []).map(n => n + nodeOffset);

    const wrapperNode: GltfNode = {
      name: addon.name,
      translation: [px, py, pz],
      rotation: quat,
      scale: [sx, sy, sz],
      children: addonRootNodes,
    };
    merged.nodes!.push(wrapperNode);
    merged.scenes![0].nodes!.push(merged.nodes!.length - 1);
  }

  const mergedBin = Buffer.concat(chunks);
  merged.buffers = [{ byteLength: mergedBin.byteLength }];

  return packGlb(merged, mergedBin);
}

// ── Route ─────────────────────────────────────────────────────────────────────

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: projectId } = await params;
  const { addons } = (await req.json()) as { addons: AddonInput[] };

  if (!addons?.length) {
    return NextResponse.json({ error: "No addons provided" }, { status: 400 });
  }

  const supabase = db();
  const { data: project } = await supabase
    .from("projects").select("model_url").eq("id", projectId).single();
  if (!project?.model_url) {
    return NextResponse.json({ error: "Project model not found" }, { status: 404 });
  }

  // Download all GLBs in parallel
  let baseGlb: Buffer;
  let addonGlbs: Buffer[];
  try {
    [baseGlb, ...addonGlbs] = await Promise.all([
      fetchGlb(project.model_url),
      ...addons.map(a => fetchGlb(a.modelUrl)),
    ]);
  } catch (err: unknown) {
    return NextResponse.json({ error: `Download failed: ${(err as Error).message}` }, { status: 502 });
  }

  // Parse all
  const base = readGlb(baseGlb);
  const parsedAddons = addonGlbs.map((buf, i) => ({ ...readGlb(buf), addon: addons[i] }));

  // Merge
  let merged: Buffer;
  try {
    merged = mergeGlbs(base, parsedAddons);
  } catch (err: unknown) {
    return NextResponse.json({ error: `Merge failed: ${(err as Error).message}` }, { status: 500 });
  }

  // Upload merged GLB
  const key = `models/${projectId}/model_baked_${Date.now()}.glb`;
  let modelUrl: string;
  try {
    modelUrl = await uploadToR2(key, merged, "model/gltf-binary");
  } catch (err: unknown) {
    return NextResponse.json({ error: `Upload failed: ${(err as Error).message}` }, { status: 500 });
  }

  // Update project record
  const { error: updateErr } = await supabase
    .from("projects")
    .update({ model_url: modelUrl, model_storage_path: key })
    .eq("id", projectId);
  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 });

  return NextResponse.json({ ok: true, modelUrl, storagePath: key });
}
