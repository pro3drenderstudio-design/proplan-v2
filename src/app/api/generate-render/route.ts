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
    "preserve all material colors and finishes exactly as shown — floor color and material must stay identical, wall paint color must stay identical, ceiling color must stay identical, cabinet color and finish must stay identical, countertop color and material must stay identical",
    "do not change any existing colors, materials, or textures from the original image",
    "keep all existing furniture, appliances, and objects exactly as shown — do not add or remove any furniture, sofas, chairs, tables, rugs, or objects that are not already present",
    "only add small tasteful surface props that are consistent with the room type shown: if kitchen is visible add only a fruit bowl or herb plant on the counter, if living area is visible add only a throw pillow or folded blanket on existing sofas",
    "do not invent new rooms, furniture layouts, or seating areas not visible in the original",
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
