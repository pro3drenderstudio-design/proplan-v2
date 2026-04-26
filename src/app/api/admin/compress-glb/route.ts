/**
 * POST /api/admin/compress-glb
 *
 * Accepts a GLB file as multipart/form-data and applies Draco mesh compression
 * using @gltf-transform. All mesh names, scene hierarchy, and primitives are
 * preserved — only geometry attributes are compressed.
 *
 * FormData fields:
 *   model             File   — the .glb file
 *   method            string — "edgebreaker" (default) | "sequential"
 *   quantizePosition  number — bits (1-16, default 14)
 *   quantizeNormal    number — bits (1-16, default 10)
 *   quantizeTexcoord  number — bits (1-16, default 12)
 *   quantizeColor     number — bits (1-16, default 8)
 *   quantizeGeneric   number — bits (1-16, default 12)
 *
 * Returns the compressed GLB binary with size info in response headers.
 */

import { NextRequest, NextResponse } from "next/server";
import { NodeIO } from "@gltf-transform/core";
import { KHRDracoMeshCompression } from "@gltf-transform/extensions";
import { draco } from "@gltf-transform/functions";

export const runtime     = "nodejs";
export const maxDuration = 120;

// ── Lazy-init Draco (cached across requests in the Node.js process) ───────────
let _io: NodeIO | null = null;

async function getIO(): Promise<NodeIO> {
  if (_io) return _io;
  // draco3d is a CJS package
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const draco3d = require("draco3d") as {
    createEncoderModule: () => Promise<unknown>;
    createDecoderModule: () => Promise<unknown>;
  };
  const [encoder, decoder] = await Promise.all([
    draco3d.createEncoderModule(),
    draco3d.createDecoderModule(),
  ]);
  _io = new NodeIO()
    .registerExtensions([KHRDracoMeshCompression])
    .registerDependencies({
      "draco3d.encoder": encoder,
      "draco3d.decoder": decoder,
    });
  return _io;
}

// ── Route ─────────────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "Invalid multipart request" }, { status: 400 });
  }

  const file = formData.get("model");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }
  if (!file.name.match(/\.glb$/i)) {
    return NextResponse.json({ error: "Only .glb files are accepted" }, { status: 400 });
  }

  const rawMethod = String(formData.get("method") ?? "");
  const method: "edgebreaker" | "sequential" =
    rawMethod === "sequential" ? "sequential" : "edgebreaker";

  try {
    const io  = await getIO();
    const buf = new Uint8Array(await file.arrayBuffer());
    const doc = await io.readBinary(buf);

    await doc.transform(
      draco({
        method,
        quantizePosition: clamp(formData.get("quantizePosition"), 14),
        quantizeNormal:   clamp(formData.get("quantizeNormal"),   10),
        quantizeTexcoord: clamp(formData.get("quantizeTexcoord"), 12),
        quantizeColor:    clamp(formData.get("quantizeColor"),     8),
        quantizeGeneric:  clamp(formData.get("quantizeGeneric"),  12),
      })
    );

    const out     = await io.writeBinary(doc);
    const outName = file.name.replace(/\.glb$/i, ".draco.glb");

    console.log(
      `[compress-glb] ${file.name}  ${fmt(file.size)} → ${fmt(out.byteLength)}` +
      `  (${Math.round((1 - out.byteLength / file.size) * 100)}% smaller)`
    );

    return new NextResponse(out, {
      headers: {
        "Content-Type":        "model/gltf-binary",
        "Content-Disposition": `attachment; filename="${outName}"`,
        "X-Original-Size":     String(file.size),
        "X-Compressed-Size":   String(out.byteLength),
        "X-Filename":          outName,
      },
    });
  } catch (err: unknown) {
    const msg = (err as Error).message ?? "Compression failed";
    console.error("[compress-glb]", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

function clamp(val: FormDataEntryValue | null, def: number): number {
  const n = parseInt(String(val ?? ""), 10);
  return Number.isFinite(n) ? Math.min(16, Math.max(1, n)) : def;
}

function fmt(bytes: number) {
  if (bytes >= 1_000_000) return `${(bytes / 1_000_000).toFixed(2)} MB`;
  return `${(bytes / 1_000).toFixed(0)} KB`;
}
