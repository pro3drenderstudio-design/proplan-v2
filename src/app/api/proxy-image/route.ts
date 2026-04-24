import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get("url");
  if (!url) return NextResponse.json({ error: "url required" }, { status: 400 });

  try {
    const upstream = await fetch(url, { cache: "no-store" });
    if (!upstream.ok) return NextResponse.json({ error: "upstream failed" }, { status: 502 });
    const buf = await upstream.arrayBuffer();
    const ct = upstream.headers.get("content-type") ?? "image/jpeg";
    return new NextResponse(buf, {
      headers: { "Content-Type": ct, "Cache-Control": "public, max-age=3600" },
    });
  } catch {
    return NextResponse.json({ error: "proxy error" }, { status: 500 });
  }
}
