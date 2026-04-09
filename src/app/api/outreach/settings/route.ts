import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function supabase() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

export async function GET() {
  const { data, error } = await supabase().from("outreach_settings").select("key, value");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const obj: Record<string, string> = {};
  for (const row of data ?? []) obj[row.key] = row.value ?? "";
  return NextResponse.json(obj);
}

export async function POST(req: NextRequest) {
  const body = await req.json() as Record<string, string>;
  const rows = Object.entries(body).map(([key, value]) => ({ key, value, updated_at: new Date().toISOString() }));
  const { error } = await supabase()
    .from("outreach_settings")
    .upsert(rows, { onConflict: "key" });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
