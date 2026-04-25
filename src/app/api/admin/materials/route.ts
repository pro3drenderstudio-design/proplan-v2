/**
 * GET  /api/admin/materials        — list all materials
 * POST /api/admin/materials        — create a new material
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function supabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

export async function GET() {
  const db = supabase();
  const { data, error } = await db
    .from("material_library")
    .select("*")
    .order("category", { ascending: true })
    .order("name", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { name, category, base_color, roughness, metalness, normal_map_url, thumbnail_url, properties } = body;

  if (!name || !base_color) {
    return NextResponse.json({ error: "name and base_color are required" }, { status: 400 });
  }

  const db = supabase();
  const { data, error } = await db
    .from("material_library")
    .insert({
      name,
      category: category ?? null,
      base_color,
      roughness: roughness ?? 0.5,
      metalness: metalness ?? 0.0,
      normal_map_url: normal_map_url ?? null,
      thumbnail_url: thumbnail_url ?? null,
      properties: properties ?? {},
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
