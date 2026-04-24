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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let { data, error } = await (supabase.from("lots") as any).insert(payload).select().single();

  // If text_color column doesn't exist yet, retry without it
  if (error?.message?.includes("text_color")) {
    delete payload.text_color;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ({ data, error } = await (supabase.from("lots") as any).insert(payload).select().single());
  }

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
