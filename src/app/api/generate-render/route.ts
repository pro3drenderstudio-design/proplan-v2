import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const maxDuration = 120;

const FAL_KEY = process.env.FAL_KEY;

// Service-role client for storage uploads
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

const PROMPT = [
  "photorealistic architectural exterior render",
  "keep the building structure completely identical — same windows, doors, roofline, garage",
  "add lush professionally landscaped front yard",
  "large mature oak and maple trees flanking both sides of the house",
  "trimmed boxwood hedges along the building foundation",
  "colorful flower beds with roses and lavender in the foreground",
  "thick manicured green lawn covering the entire front yard",
  "stone walkway from driveway to front door lined with low plants",
  "golden hour warm lighting, amber sunlight raking across the facade",
  "long soft shadows stretching across the lawn",
  "deep orange and soft pink sunset sky with volumetric clouds",
  "warm light glowing in the windows",
  "professional real estate photography, award-winning architectural photography",
  "8k ultra-detailed, Hasselblad medium format",
].join(", ");

export async function POST(req: NextRequest) {
  if (!FAL_KEY) {
    return NextResponse.json({ error: "FAL_KEY not configured" }, { status: 503 });
  }

  let imageBase64: string;
  try {
    ({ imageBase64 } = (await req.json()) as { imageBase64: string });
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  // Upload input image to Supabase Storage to get a public URL for fal.ai
  const imageBuffer     = Buffer.from(imageBase64, "base64");
  const inputFileName   = `configurator-input-${Date.now()}.png`;
  const { error: uploadErr } = await supabase.storage
    .from("render-studio")
    .upload(inputFileName, imageBuffer, { contentType: "image/png", upsert: false });

  if (uploadErr) {
    console.error("Input upload error:", uploadErr.message);
    return NextResponse.json({ error: `Upload failed: ${uploadErr.message}` }, { status: 500 });
  }

  const { data: urlData } = supabase.storage.from("render-studio").getPublicUrl(inputFileName);
  const inputImageUrl = urlData.publicUrl;

  // ── Submit to fal.ai queue ────────────────────────────────────────────────
  const submitRes = await fetch("https://queue.fal.run/fal-ai/nano-banana-2/edit", {
    method: "POST",
    headers: {
      Authorization:  `Key ${FAL_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      image_urls: [inputImageUrl],
      prompt:     PROMPT,
    }),
  });

  if (!submitRes.ok) {
    const text = await submitRes.text();
    console.error("fal.ai submit error:", submitRes.status, text);
    return NextResponse.json({ error: text }, { status: submitRes.status });
  }

  const { status_url, response_url } = (await submitRes.json()) as {
    request_id:   string;
    status_url:   string;
    response_url: string;
  };

  // ── Poll until complete ───────────────────────────────────────────────────
  const falHeaders = { Authorization: `Key ${FAL_KEY}` };

  for (let i = 0; i < 60; i++) {
    await new Promise(r => setTimeout(r, 2000));
    const statusRes = await fetch(status_url, { headers: falHeaders });
    if (!statusRes.ok) continue;
    const { status } = (await statusRes.json()) as { status: string };
    if (status === "COMPLETED") break;
    if (status === "FAILED") {
      return NextResponse.json({ error: "fal.ai job failed" }, { status: 502 });
    }
  }

  // ── Fetch result ──────────────────────────────────────────────────────────
  const resultRes = await fetch(response_url, { headers: falHeaders });
  if (!resultRes.ok) {
    const text = await resultRes.text();
    console.error("fal.ai result error:", resultRes.status, text);
    return NextResponse.json({ error: text }, { status: resultRes.status });
  }

  const json = (await resultRes.json()) as { images?: { url: string }[] };
  const resultImageUrl = json.images?.[0]?.url;

  if (!resultImageUrl) {
    return NextResponse.json({ error: "No image returned from fal.ai" }, { status: 502 });
  }

  const resultBuffer   = Buffer.from(await (await fetch(resultImageUrl)).arrayBuffer());
  const imageBase64Out = resultBuffer.toString("base64");

  return NextResponse.json({ imageBase64: imageBase64Out });
}
