import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function supabase() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

export async function GET(req: NextRequest) {
  const db = supabase();
  const limit = parseInt(req.nextUrl.searchParams.get("limit") ?? "50", 10);

  const { data, error } = await db
    .from("outreach_replies")
    .select("*, inbox:outreach_inboxes(id, label, email_address)")
    .is("enrollment_id", null)
    .eq("is_filtered", false)
    .order("received_at", { ascending: false })
    .limit(limit);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

/** Mark an unmatched reply as ignored (filtered) */
export async function DELETE(req: NextRequest) {
  const { id } = await req.json();
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const { error } = await supabase()
    .from("outreach_replies")
    .update({ is_filtered: true, filter_reason: "manually ignored" })
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
