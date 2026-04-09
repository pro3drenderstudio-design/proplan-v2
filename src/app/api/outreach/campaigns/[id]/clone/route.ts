import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function supabase() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = supabase();

  // Fetch original campaign
  const { data: campaign, error: cErr } = await db
    .from("outreach_campaigns")
    .select("*")
    .eq("id", id)
    .single();

  if (cErr || !campaign) {
    return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
  }

  // Fetch sequence steps
  const { data: steps } = await db
    .from("outreach_sequences")
    .select("*")
    .eq("campaign_id", id)
    .order("step_order", { ascending: true });

  // Create cloned campaign (status = draft, new name)
  const { id: _id, created_at, updated_at, ...campaignFields } = campaign;
  const { data: cloned, error: cloneErr } = await db
    .from("outreach_campaigns")
    .insert({
      ...campaignFields,
      name:   `${campaign.name} (Copy)`,
      status: "draft",
    })
    .select()
    .single();

  if (cloneErr || !cloned) {
    return NextResponse.json({ error: cloneErr?.message ?? "Failed to clone campaign" }, { status: 500 });
  }

  // Clone sequence steps
  if (steps?.length) {
    const clonedSteps = steps.map(({ id: _sid, campaign_id: _cid, created_at: _ca, ...stepFields }) => ({
      ...stepFields,
      campaign_id: cloned.id,
    }));
    await db.from("outreach_sequences").insert(clonedSteps);
  }

  return NextResponse.json(cloned, { status: 201 });
}
