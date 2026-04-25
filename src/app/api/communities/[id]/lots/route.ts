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
    price_modifier: body.price_modifier ?? 0,
    notes:          body.notes          ?? null,
  };
  if (body.text_color != null) payload.text_color = body.text_color;
  if (body.label_x != null) payload.label_x = body.label_x;
  if (body.label_y != null) payload.label_y = body.label_y;
  if (body.label_font_size != null) payload.label_font_size = body.label_font_size;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let { data, error } = await (supabase.from("lots") as any).insert(payload).select().single();

  // If new columns don't exist yet, retry without them
  if (error?.message?.includes("text_color") || error?.message?.includes("label_")) {
    delete payload.text_color;
    delete payload.label_x;
    delete payload.label_y;
    delete payload.label_font_size;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ({ data, error } = await (supabase.from("lots") as any).insert(payload).select().single());
  }

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
