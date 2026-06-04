import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const search    = searchParams.get("search") ?? "";
  const builderId = searchParams.get("builderId") ?? "";

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (supabase.from("floor_plans") as any)
    .select("*, builders!inner(id, company_name, company_slug, logo_url)")
    .order("created_at", { ascending: false })
    .limit(200);

  if (builderId) query = query.eq("builder_id", builderId);
  if (search)    query = query.ilike("name", `%${search}%`);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  if (!body.builder_id) return NextResponse.json({ error: "builder_id is required" }, { status: 400 });
  if (!body.name?.trim()) return NextResponse.json({ error: "name is required" }, { status: 400 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from("floor_plans") as any)
    .insert({
      builder_id:        body.builder_id,
      name:              body.name.trim(),
      description:       body.description       ?? null,
      beds:              body.beds               ?? null,
      baths:             body.baths              ?? null,
      floors:            body.floors             ?? null,
      sqft_min:          body.sqft_min           ?? null,
      sqft_max:          body.sqft_max           ?? null,
      sqft:              body.sqft_min           ?? null,
      garage_spaces:     body.garage_spaces      ?? null,
      home_style:        body.home_style         ?? null,
      base_price:        body.base_price         ?? null,
      thumbnail_url:     body.thumbnail_url      ?? null,
      floor_plan_images: body.floor_plan_images  ?? [],
      project_id:        body.project_id         ?? null,
      sort_order:        body.sort_order         ?? 0,
      is_active:         true,
    })
    .select("*, builders!inner(id, company_name, company_slug, logo_url)")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
