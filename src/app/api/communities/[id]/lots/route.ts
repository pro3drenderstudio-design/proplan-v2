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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from("lots") as any)
    .insert({
      community_id:   communityId,
      lot_number:     body.lot_number,
      polygon:        body.polygon,
      status:         body.status         ?? "available",
      project_id:     body.project_id     ?? null,
      price_modifier: body.price_modifier ?? 0,
      notes:          body.notes          ?? null,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
