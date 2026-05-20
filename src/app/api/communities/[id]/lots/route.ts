import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: communityId } = await params;
  const body = await req.json().catch(() => null);
  if (!body?.lot_number || !body?.polygon) {
    return NextResponse.json({ error: "lot_number and polygon are required" }, { status: 400 });
  }

  const payload: Record<string, unknown> = {
    community_id:   communityId,
    lot_number:     body.lot_number,
    polygon:        body.polygon,
    status:         body.status         ?? "available",
    project_id:     body.project_id     ?? null,
    floor_plan_id:  body.floor_plan_id  ?? null,
    price_modifier: body.price_modifier ?? 0,
    notes:          body.notes          ?? null,
    // label display
    text_color:     body.text_color     ?? null,
    label_x:        body.label_x        ?? null,
    label_y:        body.label_y        ?? null,
    label_font_size: body.label_font_size ?? null,
    // legacy single CTA (kept for backward compat)
    cta_type:       body.cta_type       ?? "configurator",
    cta_label:      body.cta_label      ?? null,
    cta_url:        body.cta_url        ?? null,
    // v12 multi-CTA + new fields
    ctas:                 body.ctas                 ?? [],
    lot_size_sqft:        body.lot_size_sqft        ?? null,
    lot_width_ft:         body.lot_width_ft         ?? null,
    lot_depth_ft:         body.lot_depth_ft         ?? null,
    phase:                body.phase                ?? 1,
    estimated_completion: body.estimated_completion ?? null,
    virtual_tour_url:     body.virtual_tour_url     ?? null,
    is_coming_soon:       body.is_coming_soon       ?? false,
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from("lots") as any).insert(payload).select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function PATCH(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: communityId } = await params;

  // Reset all per-lot label customizations so they inherit from map_settings
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.from("lots") as any)
    .update({ text_color: null, label_font_size: null })
    .eq("community_id", communityId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
