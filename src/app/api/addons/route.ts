import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: NextRequest) {
  const slug = req.nextUrl.searchParams.get("slug");

  let query = supabase.from("addons").select("*").eq("is_active", true);
  if (slug) {
    const { data, error } = await query.eq("slug", slug).single();
    if (error) return NextResponse.json(null, { status: 404 });
    return NextResponse.json(data);
  }

  const { data, error } = await query.order("sort_order", { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}
