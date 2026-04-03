import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const maxDuration = 120;

const FAL_KEY = process.env.FAL_KEY;
const BUCKET  = "render-studio";

// Service-role client — bypasses RLS for server-side storage operations
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

// ── Prompt building blocks ────────────────────────────────────────────────────

const STYLE_PROMPTS: Record<string, string> = {
  modern:        "modern minimalist style, clean lines, concrete and glass materials, open plan",
  traditional:   "traditional style, brick or stone materials, classic proportions, warm tones",
  craftsman:     "craftsman style, natural wood and stone, warm earthy tones, cozy atmosphere",
  contemporary:  "contemporary style, mixed materials, bold design, seamless indoor-outdoor flow",
  mediterranean: "mediterranean style, terracotta, warm plaster walls, arched details, warm colours",
  colonial:      "colonial style, symmetrical layout, formal proportions, classic materials",
};

const LIGHTING_PROMPTS: Record<string, string> = {
  golden_hour: "golden hour warm lighting, amber sunlight, long shadows, orange and pink sky",
  midday:      "bright clear midday sunlight, vivid blue sky, crisp shadows",
  dusk:        "blue hour twilight, warm glowing interior lights, deep navy sky",
  overcast:    "soft overcast diffused lighting, moody atmosphere, rich colours",
  night:       "night scene, exterior uplighting, dramatic shadows, dark sky, glowing windows",
};

const SEASON_PROMPTS: Record<string, string> = {
  summer: "lush summer landscaping, thick green lawn, full canopy trees, colourful flowers",
  spring: "spring landscaping, fresh green grass, blooming flowers, cherry blossoms",
  fall:   "autumn landscaping, orange and red foliage, fallen leaves, warm earthy tones",
  winter: "winter scene, light snow dusting, bare trees, frost on garden beds",
};

const LANDSCAPE_PROMPTS: Record<string, string> = {
  lush:     "lush landscaped front yard, mature trees flanking both sides, boxwood hedges, flower beds, stone walkway",
  desert:   "desert xeriscape, ornamental grasses, agave, succulent beds, gravel mulch",
  minimal:  "minimal modern landscaping, clean lawn, architectural grasses, concrete planters",
  tropical: "tropical landscaping, palm trees, bird of paradise, lush banana leaf plants",
};

// ── Prompts per render type ───────────────────────────────────────────────────

function buildPrompt(body: {
  renderType: string;
  style: string;
  lighting: string;
  season: string;
  landscape: string;
  revision?: string;
  isRevision?: boolean;
}): string {
  const { renderType, style, lighting, season, landscape, revision, isRevision } = body;

  if (isRevision && revision) {
    return [
      revision,
      "keep building structure identical",
      "photorealistic architectural render, 8k ultra-detailed",
      STYLE_PROMPTS[style] ?? "",
      LIGHTING_PROMPTS[lighting] ?? "",
    ].filter(Boolean).join(", ");
  }

  if (renderType === "floor_plan") {
    return [
      "convert this 2D floor plan into a photorealistic 3D top-down architectural visualization",
      "furnished rooms with realistic furniture, materials and textures",
      "hardwood floors in living areas, tile in bathrooms and kitchen, carpet in bedrooms",
      "realistic soft furnishings, kitchen appliances, bathroom fixtures",
      STYLE_PROMPTS[style] ?? "",
      "soft ambient interior lighting, warm and inviting atmosphere",
      "professional architectural visualization, 8k ultra-detailed, clean white walls",
    ].filter(Boolean).join(", ");
  }

  if (renderType === "interior") {
    return [
      "convert this into a photorealistic interior architectural render",
      "beautiful materials and finishes throughout",
      STYLE_PROMPTS[style] ?? "",
      LIGHTING_PROMPTS[lighting] ?? "",
      "professional interior photography, Hasselblad medium format, 8k ultra-detailed",
    ].filter(Boolean).join(", ");
  }

  // elevation
  return [
    "convert this architectural elevation drawing into a photorealistic exterior render",
    "faithful to the reference geometry — identical windows, doors, roofline, garage",
    "professional real estate photography, award-winning architectural photography",
    STYLE_PROMPTS[style] ?? "",
    LIGHTING_PROMPTS[lighting] ?? "",
    SEASON_PROMPTS[season] ?? "",
    LANDSCAPE_PROMPTS[landscape] ?? "",
    "8k ultra-detailed, Hasselblad medium format",
  ].filter(Boolean).join(", ");
}

// ── Route ─────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  if (!FAL_KEY) {
    return NextResponse.json({ error: "FAL_KEY not configured" }, { status: 503 });
  }

  let body: {
    imageBase64?: string;
    imageUrl?: string;          // pre-hosted URL (used for revisions)
    renderType: string;
    style: string;
    lighting: string;
    season: string;
    landscape: string;
    revision?: string;
    isRevision?: boolean;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const prompt = buildPrompt(body);

  // Use a pre-hosted URL directly (revisions) or upload the raw image
  let uploadedImageUrl: string;

  if (body.imageUrl) {
    uploadedImageUrl = body.imageUrl;
  } else {
    if (!body.imageBase64) {
      return NextResponse.json({ error: "imageBase64 or imageUrl required" }, { status: 400 });
    }
    const imageBuffer    = Buffer.from(body.imageBase64, "base64");
    const inputFileName  = `input-${Date.now()}.png`;
    const { error: inputUploadError } = await supabase.storage
      .from(BUCKET)
      .upload(inputFileName, imageBuffer, { contentType: "image/png", upsert: false });

    if (inputUploadError) {
      console.error("Input upload error:", inputUploadError.message);
      return NextResponse.json({ error: `Input upload failed: ${inputUploadError.message}` }, { status: 500 });
    }

    const { data: inputUrlData } = supabase.storage.from(BUCKET).getPublicUrl(inputFileName);
    uploadedImageUrl = inputUrlData.publicUrl;
  }

  // ── Submit to fal.ai queue ────────────────────────────────────────────────
  const submitRes = await fetch("https://queue.fal.run/fal-ai/nano-banana-2/edit", {
    method: "POST",
    headers: {
      Authorization:  `Key ${FAL_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      image_urls: [uploadedImageUrl],
      prompt,
    }),
  });

  if (!submitRes.ok) {
    const text = await submitRes.text();
    console.error("fal.ai submit error:", submitRes.status, text);
    return NextResponse.json({ error: text }, { status: submitRes.status });
  }

  const submitJson = (await submitRes.json()) as {
    request_id: string;
    status_url: string;
    response_url: string;
  };
  console.log("fal.ai submit:", JSON.stringify(submitJson));

  // ── Poll until complete ───────────────────────────────────────────────────
  const statusUrl = submitJson.status_url;
  const resultUrl = submitJson.response_url;
  const falHeaders = { Authorization: `Key ${FAL_KEY}` };

  for (let attempt = 0; attempt < 60; attempt++) {
    await new Promise(r => setTimeout(r, 2000)); // wait 2s between polls
    const statusRes = await fetch(statusUrl, { headers: falHeaders });
    if (!statusRes.ok) continue;
    const { status } = (await statusRes.json()) as { status: string };
    if (status === "COMPLETED") break;
    if (status === "FAILED") {
      return NextResponse.json({ error: "fal.ai job failed" }, { status: 502 });
    }
  }

  // ── Fetch result ──────────────────────────────────────────────────────────
  const resultRes = await fetch(resultUrl, { headers: falHeaders });
  if (!resultRes.ok) {
    const text = await resultRes.text();
    console.error("fal.ai result error:", resultRes.status, text);
    return NextResponse.json({ error: text }, { status: resultRes.status });
  }

  const json = (await resultRes.json()) as { images?: { url: string }[] };
  console.log("fal.ai result:", JSON.stringify(json).slice(0, 300));
  const resultImageUrl = json.images?.[0]?.url;

  if (!resultImageUrl) {
    return NextResponse.json({ error: "No image returned from fal.ai" }, { status: 502 });
  }

  // Fetch from CDN → buffer
  const resultBuffer      = Buffer.from(await (await fetch(resultImageUrl)).arrayBuffer());
  const imageBase64Result = resultBuffer.toString("base64");

  // ── Persist ───────────────────────────────────────────────────────────────
  let savedImageUrl = resultImageUrl;

  const fileName = `${Date.now()}-${body.renderType}.jpg`;
  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(fileName, resultBuffer, { contentType: "image/jpeg", upsert: false });

  if (!uploadError) {
    const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(fileName);
    savedImageUrl = urlData.publicUrl;
  } else {
    console.warn("Storage upload failed:", uploadError.message);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: renderRow, error: dbError } = await (supabase.from("renders") as any)
    .insert({
      render_type: body.renderType,
      style:       body.style,
      lighting:    body.lighting,
      season:      body.season      ?? null,
      landscape:   body.landscape   ?? null,
      image_url:   savedImageUrl,
      is_revision: body.isRevision  ?? false,
    })
    .select("id")
    .single();

  if (dbError) console.warn("renders insert failed:", dbError.message);

  return NextResponse.json({
    imageBase64: imageBase64Result,
    imageUrl:    savedImageUrl,
    renderId:    renderRow?.id ?? null,
  });
}
