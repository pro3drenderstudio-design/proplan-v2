import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

// Service-role client — bypasses RLS so the builder always sees their own renders
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export async function GET(req: NextRequest) {
  const builderId = req.nextUrl.searchParams.get("builderId");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (supabase.from("renders") as any)
    .select("*")
    .order("created_at", { ascending: false });

  if (builderId) {
    query = query.eq("builder_id", builderId);
  }

  const { data, error } = await query;

  if (error) {
    console.error("render-studio/archive:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data ?? []);
}
