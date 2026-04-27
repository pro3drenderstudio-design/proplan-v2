import { NextRequest, NextResponse } from "next/server";
import sharp from "sharp";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code") ?? "";

  // Accept: "SW 7008", "SW7008", "7008"
  const match = code.replace(/\s/g, "").match(/(?:sw)?(\d{4,5})/i);
  if (!match) {
    return NextResponse.json(
      { error: "Invalid code — expected format: SW 7008" },
      { status: 400 },
    );
  }
  const num = match[1];

  // Sherwin-Williams hosts color chip images via their Scene7 CDN.
  // Requesting 32×32 avoids JPEG quantisation artifacts on very small sizes
  // while keeping the payload tiny. We then resize to 1×1 in sharp so the
  // entire chip averages to a single representative RGB.
  const chipUrl =
    `https://sherwin.scene7.com/is/image/sw/sw${num}` +
    `?wid=32&hei=32&fmt=jpeg&op_usm=0,0,0,0`;

  let buf: Buffer;
  try {
    const res = await fetch(chipUrl, {
      headers: { Accept: "image/jpeg,image/*" },
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) {
      return NextResponse.json(
        { error: `SW ${num} not found — check the paint code` },
        { status: 404 },
      );
    }
    buf = Buffer.from(await res.arrayBuffer());
  } catch {
    return NextResponse.json({ error: "Could not reach Sherwin-Williams" }, { status: 502 });
  }

  try {
    // Resize to 1×1 → average of all pixels = dominant swatch colour
    const { data } = await sharp(buf)
      .resize(1, 1, { fit: "fill", kernel: "lanczos3" })
      .raw()
      .toBuffer({ resolveWithObject: true });

    const hex =
      "#" +
      [data[0], data[1], data[2]]
        .map(v => v.toString(16).padStart(2, "0"))
        .join("");

    return NextResponse.json({ hex, code: `SW ${num}` });
  } catch {
    return NextResponse.json({ error: "Failed to sample color" }, { status: 500 });
  }
}
