import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function supabase() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

/** GET /api/outreach/campaigns/[id]/enrollments?page=0&limit=50&status=all */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: campaignId } = await params;
  const { searchParams } = new URL(req.url);
  const page   = parseInt(searchParams.get("page")  ?? "0");
  const limit  = Math.min(parseInt(searchParams.get("limit") ?? "50"), 100);
  const status = searchParams.get("status") ?? "all";

  const db = supabase();

  let query = db
    .from("outreach_enrollments")
    .select(`
      id, status, current_step, next_send_at, ab_variant, created_at, updated_at,
      lead:outreach_leads!lead_id(id, email, first_name, last_name, company, title)
    `, { count: "exact" })
    .eq("campaign_id", campaignId)
    .order("created_at", { ascending: false })
    .range(page * limit, (page + 1) * limit - 1);

  if (status !== "all") query = query.eq("status", status);

  const { data, count, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ enrollments: data ?? [], total: count ?? 0 });
}
