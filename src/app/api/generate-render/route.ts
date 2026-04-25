import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 60;

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-image-preview:generateContent";

const PROMPTS: Record<string, string> = {
  exterior: [
    "photorealistic architectural exterior render",
    "preserve every color and material exactly as shown in the input image — roof tile color must remain identical, siding color must remain identical, window frame color must remain identical, door color must remain identical, trim color must remain identical",
    "do not change any paint colors, material colors, or finishes from the original",
    "keep the building structure completely identical — same windows, doors, roofline shape, garage placement",
    "add lush professionally landscaped front yard with large mature trees flanking both sides",
    "trimmed boxwood hedges along the building foundation, colorful flower beds with roses and lavender in the foreground",
    "thick manicured green lawn, stone walkway from driveway to front door",
    "add tasteful outdoor lifestyle props: a luxury sedan parked in the driveway, Adirondack chairs or a bistro set on the front porch, potted topiaries flanking the front door, hanging lantern sconces, a decorative welcome mat, subtle uplighting on the facade at dusk",
    "golden hour warm lighting, amber sunlight raking across the facade, long soft shadows",
    "deep orange and soft pink sunset sky with volumetric clouds, warm light glowing in the windows",
    "professional real estate photography, award-winning architectural photography",
    "8k ultra-detailed, Hasselblad medium format",
  ].join(", "),

  interior: [
    "photorealistic architectural interior render",
    "do NOT modify walls, ceiling, floor, structural elements, or any architectural surfaces — preserve every color, material, texture, and finish exactly as shown in the original",
    "do NOT change wall paint color, ceiling color, floor material, cabinet color, countertop material, or any existing finish",
    "do NOT add, remove, or rearrange any furniture, appliances, or built-in elements",
    "only enhance realism: improve lighting quality, add subtle shadows and reflections, sharpen material textures",
    "only add a very small number of tasteful props where surfaces are bare: a fruit bowl or herb plant on a kitchen counter, a throw pillow or folded blanket on an existing sofa, a framed artwork or mirror on a blank wall",
    "warm natural light streaming through windows, soft ambient recessed ceiling lighting",
    "interior design magazine photography quality, perfectly sharp focus throughout",
    "no exterior elements, no sky visible",
    "8k ultra-detailed, professional architectural photography",
  ].join(", "),
};

export async function POST(req: NextRequest) {
  if (!GEMINI_API_KEY) {
    return NextResponse.json({ error: "GEMINI_API_KEY not configured" }, { status: 503 });
  }

  let imageBase64: string;
  let mimeType = "image/jpeg";
  let phase = "exterior";
  try {
    const body = (await req.json()) as { imageBase64: string; mimeType?: string; phase?: string };
    imageBase64 = body.imageBase64;
    if (body.mimeType) mimeType = body.mimeType;
    if (body.phase) phase = body.phase;
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const prompt = PROMPTS[phase] ?? PROMPTS.exterior;

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
  const json = (await geminiRes.json()) as GeminiResponse;
  const imagePart = json.candidates?.[0]?.content?.parts?.find(p => p.inlineData);

  if (!imagePart?.inlineData) {
    console.error("Gemini returned no image:", JSON.stringify(json).slice(0, 300));
    return NextResponse.json({ error: "No image returned from Gemini" }, { status: 502 });
  }

  return NextResponse.json({ imageBase64: imagePart.inlineData.data });
}
