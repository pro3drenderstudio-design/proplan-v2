import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function supabase() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ sendId: string; linkIndex: string }> },
) {
  const { sendId, linkIndex } = await params;
  const index = parseInt(linkIndex, 10);
  const db = supabase();

  // Look up original URL from tracked links table
  const { data: link } = await db
    .from("outreach_tracked_links")
    .select("original_url")
    .eq("send_id", sendId)
    .eq("link_index", index)
    .single();

  // Update click stats
  const { data: send } = await db
    .from("outreach_sends")
    .select("clicked_at, click_count")
    .eq("id", sendId)
    .single();

  if (send) {
    await db
      .from("outreach_sends")
      .update({
        clicked_at:  send.clicked_at ?? new Date().toISOString(),
        click_count: (send.click_count ?? 0) + 1,
      })
      .eq("id", sendId);
  }

  if (!link?.original_url) {
    return NextResponse.json({ error: "Link not found" }, { status: 404 });
  }

  return NextResponse.redirect(link.original_url);
}
