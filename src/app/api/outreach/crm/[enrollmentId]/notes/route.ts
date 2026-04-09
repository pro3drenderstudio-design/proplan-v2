import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function supabase() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ enrollmentId: string }> }) {
  const { enrollmentId } = await params;
  const db = supabase();

  const { data: enrollment } = await db
    .from("outreach_enrollments")
    .select("lead_id")
    .eq("id", enrollmentId)
    .single();

  if (!enrollment) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { data } = await db
    .from("outreach_crm_notes")
    .select("*")
    .eq("lead_id", enrollment.lead_id)
    .order("created_at", { ascending: true });

  return NextResponse.json(data ?? []);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ enrollmentId: string }> }) {
  const { enrollmentId } = await params;
  const { body, author_id } = await req.json();
  const db = supabase();

  const { data: enrollment } = await db
    .from("outreach_enrollments")
    .select("lead_id")
    .eq("id", enrollmentId)
    .single();

  if (!enrollment) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { data, error } = await db
    .from("outreach_crm_notes")
    .insert({ lead_id: enrollment.lead_id, body, author_id: author_id ?? null })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
