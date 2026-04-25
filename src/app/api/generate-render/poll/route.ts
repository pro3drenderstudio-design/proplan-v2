import { NextResponse } from "next/server";

// Polling is no longer used — generate-render now returns the image synchronously.
export async function POST() {
  return NextResponse.json({ done: true, error: "Polling deprecated; use generate-render directly." });
}
