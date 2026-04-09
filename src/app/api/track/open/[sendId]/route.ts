import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// 1×1 transparent GIF
const PIXEL = Buffer.from("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7", "base64");

function supabase() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ sendId: string }> }) {
  const { sendId } = await params;
  const db = supabase();

  const { data: send } = await db
    .from("outreach_sends")
    .select("id, opened_at, open_count")
    .eq("id", sendId)
    .single();

  if (send) {
    await db
      .from("outreach_sends")
      .update({
        opened_at:  send.opened_at ?? new Date().toISOString(),
        open_count: (send.open_count ?? 0) + 1,
      })
      .eq("id", sendId);
  }

  return new NextResponse(PIXEL, {
    headers: {
      "Content-Type":  "image/gif",
      "Cache-Control": "no-store, no-cache, must-revalidate",
      "Pragma":        "no-cache",
    },
  });
}
