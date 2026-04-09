import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function supabase() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

export async function GET() {
  const db = supabase();
  const { data, error } = await db.from("outreach_templates").select("*").order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

export async function POST(req: NextRequest) {
  const { name, subject, body } = await req.json();
  if (!name || !subject || !body) {
    return NextResponse.json({ error: "name, subject, and body are required" }, { status: 400 });
  }
  const db = supabase();
  const { data, error } = await db.from("outreach_templates").insert({ name, subject, body }).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
