import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function supabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "50"), 100);

  const db = supabase();

  const { data, error } = await db
    .from("outreach_warmup_sends")
    .select(`
      id, subject, sent_at, replied_at, rescued_from_spam,
      from_inbox:outreach_inboxes!from_inbox_id(id, label, email_address),
      to_inbox:outreach_inboxes!to_inbox_id(id, label, email_address)
    `)
    .order("sent_at", { ascending: false })
    .limit(limit);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}
