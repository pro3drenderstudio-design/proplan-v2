/**
 * GET  /api/admin/presets  — list all scene presets
 * POST /api/admin/presets  — create a scene preset
 *
 * Requires this table (run once in Supabase SQL editor):
 *
 *   create table scene_presets (
 *     id         uuid default gen_random_uuid() primary key,
 *     name       text not null,
 *     settings   jsonb not null default '{}',
 *     created_at timestamptz default now()
 *   );
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
    .from("scene_presets")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

export async function POST(req: NextRequest) {
  const { name, settings } = await req.json();
  if (!name || !settings) {
    return NextResponse.json({ error: "name and settings are required" }, { status: 400 });
  }

  const { data, error } = await db()
    .from("scene_presets")
    .insert({ name, settings })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
