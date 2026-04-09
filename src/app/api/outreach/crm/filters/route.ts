import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function supabase() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

const VALID_TYPES   = ["phrase", "subject_phrase", "sender_email", "sender_domain"] as const;
const VALID_ACTIONS = ["exclude", "auto_status"] as const;

export async function GET() {
  const { data, error } = await supabase()
    .from("outreach_crm_filters")
    .select("*")
    .order("created_at");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

export async function POST(req: NextRequest) {
  const { name, type, value, action, auto_status } = await req.json();

  if (!name || !type || !value || !action)
    return NextResponse.json({ error: "name, type, value, action are required" }, { status: 400 });
  if (!VALID_TYPES.includes(type))
    return NextResponse.json({ error: "invalid type" }, { status: 400 });
  if (!VALID_ACTIONS.includes(action))
    return NextResponse.json({ error: "invalid action" }, { status: 400 });

  const { data, error } = await supabase()
    .from("outreach_crm_filters")
    .insert({ name, type, value, action, auto_status: auto_status ?? null })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const { error } = await supabase()
    .from("outreach_crm_filters")
    .delete()
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
