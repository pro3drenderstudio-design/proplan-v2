/**
 * GET  /api/admin/materials/folders  — list all folders
 * POST /api/admin/materials/folders  — create a folder
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

export async function GET() {
  const { data, error } = await db()
    .from("material_folders")
    .select("*")
    .order("sort_order", { ascending: true })
    .order("name",       { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

export async function POST(req: NextRequest) {
  const { name, sort_order } = await req.json();
  if (!name?.trim()) return NextResponse.json({ error: "name is required" }, { status: 400 });

  const { data, error } = await db()
    .from("material_folders")
    .insert({ name: name.trim(), sort_order: sort_order ?? 0 })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
