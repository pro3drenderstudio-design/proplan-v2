import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { uploadToR2 } from "@/lib/r2";

export const maxDuration = 120;

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image-preview:generateContent";

// DB-only Supabase client — storage ops have been moved to R2
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
  brickColor?: string;
  roofColor?: string;
  roofType?: string;
  shutterColor?: string;
  doorColor?: string;
  garageDoorColor?: string;
  windowTrimColor?: string;
  trimColor?: string;
  sidingColor?: string;
  sidingType?: string;
  porchPostColor?: string;
  floorType?: string;
  floorColor?: string;
  wallColor?: string;
  interiorDoorColor?: string;
  windowFrameColor?: string;
  cabinetColor?: string;
  cabinetStyle?: string;
  countertopMaterial?: string;
  countertopColor?: string;
  accentWallColor?: string;
  showTextLabels?: boolean;
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
    const interiorSpecs: string[] = [];
    if (body.floorColor && body.floorType) interiorSpecs.push(`${body.floorColor} ${body.floorType} flooring`);
    else if (body.floorColor) interiorSpecs.push(`${body.floorColor} floors`);
    else if (body.floorType) interiorSpecs.push(`${body.floorType} flooring`);
    if (body.wallColor) interiorSpecs.push(`${body.wallColor} walls`);
    if (body.accentWallColor) interiorSpecs.push(`${body.accentWallColor} accent wall`);
    if (body.interiorDoorColor) interiorSpecs.push(`${body.interiorDoorColor} interior doors`);
    if (body.windowFrameColor) interiorSpecs.push(`${body.windowFrameColor} window frames`);
    if (body.cabinetColor && body.cabinetStyle) interiorSpecs.push(`${body.cabinetColor} ${body.cabinetStyle} cabinets`);
    else if (body.cabinetColor) interiorSpecs.push(`${body.cabinetColor} cabinets`);
    else if (body.cabinetStyle) interiorSpecs.push(`${body.cabinetStyle} cabinets`);
    if (body.countertopColor && body.countertopMaterial) interiorSpecs.push(`${body.countertopColor} ${body.countertopMaterial} countertops`);
    else if (body.countertopMaterial) interiorSpecs.push(`${body.countertopMaterial} countertops`);

    return [
      "convert this 2D floor plan into a photorealistic 3D top-down architectural visualization",
      body.showTextLabels
        ? "include clear room labels, dimension annotations, and text overlays on the floor plan"
        : "no text labels, no room labels, no dimensions, no annotations, no text overlays, no numbers, no letters",
      "furnished rooms with realistic furniture, materials and textures",
      interiorSpecs.length > 0
        ? interiorSpecs.join(", ")
        : "hardwood floors in living areas, tile in bathrooms and kitchen, carpet in bedrooms",
      "realistic soft furnishings, kitchen appliances, bathroom fixtures",
      STYLE_PROMPTS[style] ?? "",
      "soft ambient interior lighting, warm and inviting atmosphere",
      "professional architectural visualization, 8k ultra-detailed",
      "pure white background outside the floor plan boundary, white paper background",
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

  // elevation — build optional color spec
  const colorSpecs: string[] = [];
  if (body.brickColor) colorSpecs.push(`${body.brickColor} brick`);
  if (body.sidingColor && body.sidingType) colorSpecs.push(`${body.sidingColor} ${body.sidingType} siding`);
  else if (body.sidingColor) colorSpecs.push(`${body.sidingColor} siding`);
  else if (body.sidingType) colorSpecs.push(`${body.sidingType} siding`);
  if (body.roofColor && body.roofType) colorSpecs.push(`${body.roofColor} ${body.roofType} roof`);
  else if (body.roofColor) colorSpecs.push(`${body.roofColor} roof`);
  else if (body.roofType) colorSpecs.push(`${body.roofType} roof`);
  if (body.trimColor) colorSpecs.push(`${body.trimColor} exterior trim`);
  if (body.windowTrimColor) colorSpecs.push(`${body.windowTrimColor} window trim`);
  if (body.doorColor) colorSpecs.push(`${body.doorColor} front door`);
  if (body.garageDoorColor) colorSpecs.push(`${body.garageDoorColor} garage door`);
  if (body.shutterColor) colorSpecs.push(`${body.shutterColor} shutters`);
  if (body.porchPostColor) colorSpecs.push(`${body.porchPostColor} porch posts`);

  return [
    "convert this architectural elevation drawing into a photorealistic exterior render",
    "faithful to the reference geometry — identical windows, doors, roofline, garage",
    "professional real estate photography, award-winning architectural photography",
    STYLE_PROMPTS[style] ?? "",
    colorSpecs.length > 0 ? colorSpecs.join(", ") : "",
    LIGHTING_PROMPTS[lighting] ?? "",
    SEASON_PROMPTS[season] ?? "",
    LANDSCAPE_PROMPTS[landscape] ?? "",
    "8k ultra-detailed, Hasselblad medium format",
  ].filter(Boolean).join(", ");
}

// ── Route ─────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  if (!GEMINI_API_KEY) {
    return NextResponse.json({ error: "GEMINI_API_KEY not configured" }, { status: 503 });
  }

  let body: {
    imageBase64?: string;
    imageUrl?: string;
    renderType: string;
    style: string;
    lighting: string;
    season: string;
    landscape: string;
    revision?: string;
    isRevision?: boolean;
    builderId?: string | null;
    brickColor?: string;
    roofColor?: string;
    roofType?: string;
    shutterColor?: string;
    doorColor?: string;
    garageDoorColor?: string;
    windowTrimColor?: string;
    trimColor?: string;
    sidingColor?: string;
    sidingType?: string;
    porchPostColor?: string;
    floorType?: string;
    floorColor?: string;
    wallColor?: string;
    interiorDoorColor?: string;
    windowFrameColor?: string;
    cabinetColor?: string;
    cabinetStyle?: string;
    countertopMaterial?: string;
    countertopColor?: string;
    accentWallColor?: string;
    showTextLabels?: boolean;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const prompt = buildPrompt(body);

  // Get image as base64 — either inline or fetched from a URL (revision case)
  let imageBase64: string;
  let mimeType = "image/png";

  if (body.imageUrl) {
    try {
      const imgRes = await fetch(body.imageUrl);
      if (!imgRes.ok) throw new Error(`fetch ${imgRes.status}`);
      imageBase64 = Buffer.from(await imgRes.arrayBuffer()).toString("base64");
      mimeType = imgRes.headers.get("content-type") || "image/jpeg";
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("Image fetch error:", msg);
      return NextResponse.json({ error: `Image fetch failed: ${msg}` }, { status: 500 });
    }
  } else {
    if (!body.imageBase64) {
      return NextResponse.json({ error: "imageBase64 or imageUrl required" }, { status: 400 });
    }
    imageBase64 = body.imageBase64;
  }

  // ── Call Gemini ───────────────────────────────────────────────────────────
  const geminiRes = await fetch(`${GEMINI_URL}?key=${GEMINI_API_KEY}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{
        parts: [
          { text: prompt },
          { inline_data: { mime_type: mimeType, data: imageBase64 } },
        ],
      }],
      generationConfig: { responseModalities: ["IMAGE", "TEXT"] },
    }),
  });

  if (!geminiRes.ok) {
    const text = await geminiRes.text();
    console.error("Gemini error:", geminiRes.status, text);
    return NextResponse.json({ error: text }, { status: geminiRes.status });
  }

  type GeminiResponse = {
    candidates?: Array<{
      content?: {
        parts?: Array<{ inlineData?: { mimeType: string; data: string } }>
      }
    }>
  };
  const geminiJson = (await geminiRes.json()) as GeminiResponse;
  const imagePart = geminiJson.candidates?.[0]?.content?.parts?.find(p => p.inlineData);

  if (!imagePart?.inlineData) {
    console.error("Gemini returned no image:", JSON.stringify(geminiJson).slice(0, 300));
    return NextResponse.json({ error: "No image returned from Gemini" }, { status: 502 });
  }

  const resultBase64 = imagePart.inlineData.data;
  const resultBuffer = Buffer.from(resultBase64, "base64");

  // ── Persist output to R2 ─────────────────────────────────────────────────
  let savedImageUrl = "";
  try {
    const outputKey = `render-studio-outputs/${Date.now()}-${body.renderType}.jpg`;
    savedImageUrl = await uploadToR2(outputKey, resultBuffer, "image/jpeg");
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn("R2 output upload failed:", msg);
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
      builder_id:  body.builderId   ?? null,
    })
    .select("id")
    .single();

  if (dbError) console.warn("renders insert failed:", dbError.message);

  return NextResponse.json({
    imageBase64: resultBase64,
    imageUrl:    savedImageUrl,
    renderId:    renderRow?.id ?? null,
  });
}
