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
