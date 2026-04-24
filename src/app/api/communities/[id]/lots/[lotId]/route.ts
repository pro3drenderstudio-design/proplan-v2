import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; lotId: string }> },
) {
  const { lotId } = await params;
  const body = await req.json().catch(() => ({}));

  const payload = { ...body, updated_at: new Date().toISOString() };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let { error } = await (supabase.from("lots") as any).update(payload).eq("id", lotId);

  // If new columns don't exist yet, retry without them
  if (error?.message?.includes("text_color") || error?.message?.includes("label_")) {
    delete payload.text_color;
    delete payload.label_x;
    delete payload.label_y;
    delete payload.label_font_size;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ({ error } = await (supabase.from("lots") as any).update(payload).eq("id", lotId));
  }

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; lotId: string }> },
) {
  const { lotId } = await params;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.from("lots") as any).delete().eq("id", lotId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
