import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function supabase() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = supabase();

  const [{ data: list }, { data: leads }] = await Promise.all([
    db.from("outreach_lists").select("*").eq("id", id).single(),
    db.from("outreach_leads").select("*").eq("list_id", id).order("created_at", { ascending: false }),
  ]);

  if (!list) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ ...list, leads: leads ?? [] });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { name, description } = await req.json();
  const { data, error } = await supabase()
    .from("outreach_lists")
    .update({ name, description })
    .eq("id", id)
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { error } = await supabase().from("outreach_lists").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
