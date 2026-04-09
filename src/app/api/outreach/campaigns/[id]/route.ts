import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function supabase() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = supabase();

  const [{ data: campaign }, { data: sequences }] = await Promise.all([
    db.from("outreach_campaigns").select("*").eq("id", id).single(),
    db.from("outreach_sequences").select("*").eq("campaign_id", id).order("step_order"),
  ]);

  if (!campaign) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Stats
  const enrollmentIds = await db
    .from("outreach_enrollments")
    .select("id, status")
    .eq("campaign_id", id);

  const ids = (enrollmentIds.data ?? []).map((e) => e.id);
  const statuses = enrollmentIds.data ?? [];

  const [{ count: sent }, { count: opened }, { count: clicked }] = await Promise.all([
    ids.length ? db.from("outreach_sends").select("id", { count: "exact", head: true }).eq("status", "sent").in("enrollment_id", ids) : Promise.resolve({ count: 0 }),
    ids.length ? db.from("outreach_sends").select("id", { count: "exact", head: true }).not("opened_at", "is", null).in("enrollment_id", ids) : Promise.resolve({ count: 0 }),
    ids.length ? db.from("outreach_sends").select("id", { count: "exact", head: true }).not("clicked_at", "is", null).in("enrollment_id", ids) : Promise.resolve({ count: 0 }),
  ]);

  return NextResponse.json({
    ...campaign,
    sequence_steps: sequences ?? [],
    stats: {
      total_enrolled:    statuses.length,
      total_active:      statuses.filter((e) => e.status === "active").length,
      total_replied:     statuses.filter((e) => e.status === "replied").length,
      total_completed:   statuses.filter((e) => e.status === "completed").length,
      total_bounced:     statuses.filter((e) => e.status === "bounced").length,
      total_unsubscribed: statuses.filter((e) => e.status === "unsubscribed").length,
      total_sent:        sent    ?? 0,
      total_opened:      opened  ?? 0,
      total_clicked:     clicked ?? 0,
    },
  });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();

  const allowed = [
    "name", "status", "inbox_ids", "list_ids", "timezone", "send_days",
    "send_start_time", "send_end_time", "daily_cap", "track_opens", "track_clicks",
    "min_delay_seconds", "max_delay_seconds", "stop_on_reply", "pause_after_open", "reply_to_email",
  ];
  const updates: Record<string, unknown> = {};
  for (const key of allowed) {
    if (key in body) updates[key] = body[key];
  }

  const { data, error } = await supabase()
    .from("outreach_campaigns")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { error } = await supabase().from("outreach_campaigns").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
