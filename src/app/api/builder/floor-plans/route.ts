import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function getBuilderIdFromSession(): Promise<string | null> {
  const cookieStore = await cookies();
  const authClient = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll() } }
  );
  const { data: { user } } = await authClient.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase
    .from("profiles").select("builder_id").eq("id", user.id).single();
  return profile?.builder_id ?? null;
}

export async function GET(req: NextRequest) {
  // Support ?builderId=xxx for public/admin use, else fall back to session
  const { searchParams } = new URL(req.url);
  const builderId = searchParams.get("builderId") ?? await getBuilderIdFromSession();
  if (!builderId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from("floor_plans") as any)
    .select("*")
    .eq("builder_id", builderId)
    .eq("is_active", true)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

export async function POST(req: NextRequest) {
  const builderId = await getBuilderIdFromSession();
  if (!builderId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  if (!body.name) return NextResponse.json({ error: "name is required" }, { status: 400 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from("floor_plans") as any)
    .insert({
      builder_id:        builderId,
      name:              body.name,
      description:       body.description        ?? null,
      beds:              body.beds               ?? null,
      baths:             body.baths              ?? null,
      floors:            body.floors             ?? null,
      sqft:              body.sqft               ?? null,
      garage_spaces:     body.garage_spaces      ?? null,
      home_style:        body.home_style         ?? null,
      base_price:        body.base_price         ?? null,
      thumbnail_url:     body.thumbnail_url      ?? null,
      floor_plan_images: body.floor_plan_images  ?? [],
      project_id:        body.project_id         ?? null,
      sort_order:        body.sort_order         ?? 0,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
