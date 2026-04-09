import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function supabase() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

export async function GET() {
  const db = supabase();
  const { data, error } = await db
    .from("outreach_campaigns")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Attach stats
  const withStats = await Promise.all(
    (data ?? []).map(async (c) => {
      const ids = await getEnrollmentIds(db, c.id);
      const [{ count: enrolled }, { count: sent }, { count: opened }, { count: replied }] = await Promise.all([
        db.from("outreach_enrollments").select("id", { count: "exact", head: true }).eq("campaign_id", c.id),
        ids.length ? db.from("outreach_sends").select("id", { count: "exact", head: true }).eq("status", "sent").in("enrollment_id", ids) : Promise.resolve({ count: 0 }),
        ids.length ? db.from("outreach_sends").select("id", { count: "exact", head: true }).not("opened_at", "is", null).in("enrollment_id", ids) : Promise.resolve({ count: 0 }),
        db.from("outreach_enrollments").select("id", { count: "exact", head: true }).eq("campaign_id", c.id).eq("status", "replied"),
      ]);
      return { ...c, total_enrolled: enrolled ?? 0, total_sent: sent ?? 0, total_opened: opened ?? 0, total_replied: replied ?? 0 };
    }),
  );

  return NextResponse.json(withStats);
}

async function getEnrollmentIds(db: ReturnType<typeof supabase>, campaignId: string): Promise<string[]> {
  const { data } = await db.from("outreach_enrollments").select("id").eq("campaign_id", campaignId);
  return (data ?? []).map((e) => e.id);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { name, inbox_ids, list_ids, timezone, send_days, send_start_time, send_end_time, daily_cap, track_opens, track_clicks } = body;

  if (!name) return NextResponse.json({ error: "name is required" }, { status: 400 });

  const { data, error } = await supabase()
    .from("outreach_campaigns")
    .insert({
      name,
      inbox_ids:       inbox_ids       ?? [],
      list_ids:        list_ids        ?? [],
      timezone:        timezone        ?? "America/New_York",
      send_days:       send_days       ?? ["mon", "tue", "wed", "thu", "fri"],
      send_start_time: send_start_time ?? "09:00",
      send_end_time:   send_end_time   ?? "17:00",
      daily_cap:       daily_cap       ?? 100,
      track_opens:     track_opens     ?? true,
      track_clicks:    track_clicks    ?? true,
      status:          "draft",
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
