import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function supabase() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

export async function GET() {
  const db = supabase();
  const { data: lists, error } = await db
    .from("outreach_lists")
    .select("id, name, description, created_at")
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Attach lead counts
  const withCounts = await Promise.all(
    (lists ?? []).map(async (list) => {
      const { count } = await db
        .from("outreach_leads")
        .select("id", { count: "exact", head: true })
        .eq("list_id", list.id);
      return { ...list, lead_count: count ?? 0 };
    }),
  );

  return NextResponse.json(withCounts);
}

export async function POST(req: NextRequest) {
  const { name, description } = await req.json();
  if (!name) return NextResponse.json({ error: "name is required" }, { status: 400 });

  const { data, error } = await supabase()
    .from("outreach_lists")
    .insert({ name, description })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
