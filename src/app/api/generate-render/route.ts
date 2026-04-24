import { NextRequest, NextResponse } from "next/server";
import { uploadToR2 } from "@/lib/r2";

export const maxDuration = 30;

const FAL_KEY = process.env.FAL_KEY;

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

// ── Submit job — returns {statusUrl, responseUrl} immediately ─────────────────
export async function POST(req: NextRequest) {
  if (!FAL_KEY) {
    return NextResponse.json({ error: "FAL_KEY not configured" }, { status: 503 });
  }

  let imageBase64: string;
  let phase = "exterior";
  try {
    const body = (await req.json()) as { imageBase64: string; phase?: string };
    imageBase64 = body.imageBase64;
    if (body.phase) phase = body.phase;
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const prompt = PROMPTS[phase] ?? PROMPTS.exterior;

  // Upload input image to R2 so fal.ai can fetch it via a public URL
  const imageBuffer = Buffer.from(imageBase64, "base64");
  const inputKey    = `configurator-inputs/${Date.now()}.png`;
  let inputImageUrl: string;
  try {
    inputImageUrl = await uploadToR2(inputKey, imageBuffer, "image/png");
  } catch (err: any) {
    console.error("R2 input upload error:", err.message);
    return NextResponse.json({ error: `Upload failed: ${err.message}` }, { status: 500 });
  }

  // Submit to fal.ai queue — do NOT poll; return URLs for client-side polling
  const submitRes = await fetch("https://queue.fal.run/fal-ai/nano-banana-2/edit", {
    method: "POST",
    headers: {
      Authorization:  `Key ${FAL_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ image_urls: [inputImageUrl], prompt }),
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

  return NextResponse.json({ statusUrl: status_url, responseUrl: response_url });
}
