import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function supabase() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

/** Enroll all active leads from a list into a campaign. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: campaignId } = await params;
  const { list_id } = await req.json();

  if (!list_id) return NextResponse.json({ error: "list_id required" }, { status: 400 });

  const db = supabase();

  // Fetch unsubscribes
  const { data: unsubs } = await db.from("outreach_unsubscribes").select("email");
  const unsubSet = new Set((unsubs ?? []).map((u) => u.email.toLowerCase()));

  // Fetch leads from the list
  const { data: leads } = await db
    .from("outreach_leads")
    .select("id, email")
    .eq("list_id", list_id)
    .eq("status", "active");

  if (!leads?.length) return NextResponse.json({ enrolled: 0 });

  const enrollments = leads
    .filter((l) => !unsubSet.has(l.email.toLowerCase()))
    .map((l) => ({
      campaign_id:  campaignId,
      lead_id:      l.id,
      current_step: 0,
      status:       "active",
      ab_variant:   Math.random() < 0.5 ? "a" : "b",
      next_send_at: new Date().toISOString(), // due immediately
    }));

  if (!enrollments.length) return NextResponse.json({ enrolled: 0 });

  // Upsert — skip already-enrolled leads
  const { data, error } = await db
    .from("outreach_enrollments")
    .upsert(enrollments, { onConflict: "campaign_id,lead_id", ignoreDuplicates: true })
    .select("id");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ enrolled: data?.length ?? 0 });
}
