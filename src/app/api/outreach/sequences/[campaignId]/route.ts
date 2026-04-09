import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function supabase() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ campaignId: string }> }) {
  const { campaignId } = await params;
  const { data, error } = await supabase()
    .from("outreach_sequences")
    .select("*")
    .eq("campaign_id", campaignId)
    .order("step_order");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

/** Full replace of sequence steps for a campaign (upsert all, delete removed). */
export async function POST(req: NextRequest, { params }: { params: Promise<{ campaignId: string }> }) {
  const { campaignId } = await params;
  const { steps } = await req.json() as { steps: Array<{ type: string; wait_days?: number; subject_template?: string; body_template?: string }> };

  if (!Array.isArray(steps)) return NextResponse.json({ error: "steps array required" }, { status: 400 });

  const db = supabase();

  // Delete existing steps
  await db.from("outreach_sequences").delete().eq("campaign_id", campaignId);

  if (!steps.length) return NextResponse.json([]);

  const rows = steps.map((s, i) => ({
    campaign_id:      campaignId,
    step_order:       i,
    type:             s.type ?? "email",
    wait_days:        s.wait_days ?? 0,
    subject_template: s.subject_template ?? null,
    body_template:    s.body_template ?? null,
  }));

  const { data, error } = await db.from("outreach_sequences").insert(rows).select();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
