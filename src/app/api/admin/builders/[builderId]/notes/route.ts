import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ builderId: string }> },
) {
  const { builderId } = await params;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from("builder_notes") as any)
    .select("*")
    .eq("builder_id", builderId)
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ builderId: string }> },
) {
  const { builderId } = await params;
  const { content, created_by } = await req.json().catch(() => ({}));
  if (!content?.trim()) return NextResponse.json({ error: "Content required" }, { status: 400 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from("builder_notes") as any)
    .insert({ builder_id: builderId, content: content.trim(), created_by: created_by || "Admin" })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ builderId: string }> },
) {
  const { builderId } = await params;
  const { noteId } = await req.json().catch(() => ({}));
  if (!noteId) return NextResponse.json({ error: "noteId required" }, { status: 400 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.from("builder_notes") as any)
    .delete()
    .eq("id", noteId)
    .eq("builder_id", builderId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
