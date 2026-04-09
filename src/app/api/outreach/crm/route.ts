import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function supabase() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

export async function GET(req: NextRequest) {
  const db = supabase();
  const limit  = parseInt(req.nextUrl.searchParams.get("limit")  ?? "50", 10);
  const offset = parseInt(req.nextUrl.searchParams.get("offset") ?? "0",  10);

  // Fetch enrollments that have replies
  const { data: enrollments, error } = await db
    .from("outreach_enrollments")
    .select(`
      id, campaign_id, lead_id, status, enrolled_at, crm_status,
      lead:outreach_leads(id, first_name, last_name, email, company, title, custom_fields),
      campaign:outreach_campaigns(id, name)
    `)
    .eq("status", "replied")
    .order("enrolled_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // For each enrollment, fetch the latest send with replied_at and any notes
  const threads = await Promise.all(
    (enrollments ?? []).map(async (e) => {
      const [{ data: sends }, { data: notes }, { data: replies }] = await Promise.all([
        db
          .from("outreach_sends")
          .select("id, subject, body, replied_at, sent_at, opened_at, open_count")
          .eq("enrollment_id", e.id)
          .not("replied_at", "is", null)
          .order("replied_at", { ascending: false })
          .limit(1),
        db
          .from("outreach_crm_notes")
          .select("id, body, author_id, created_at")
          .eq("lead_id", e.lead_id)
          .order("created_at", { ascending: false }),
        db
          .from("outreach_replies")
          .select("*")
          .eq("enrollment_id", e.id)
          .eq("is_filtered", false)
          .order("received_at", { ascending: false })
          .limit(1),
      ]);

      return {
        enrollment_id: e.id,
        lead:          e.lead,
        campaign:      e.campaign,
        latest_send:   sends?.[0] ?? null,
        latest_reply:  replies?.[0] ?? null,
        replied_at:    sends?.[0]?.replied_at ?? replies?.[0]?.received_at ?? null,
        crm_status:    e.crm_status ?? "neutral",
        notes:         notes ?? [],
      };
    }),
  );

  return NextResponse.json(threads.filter((t) => t.latest_send));
}
