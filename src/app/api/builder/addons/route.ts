import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: NextRequest) {
  const builderId = req.nextUrl.searchParams.get("builderId");
  if (!builderId) return NextResponse.json([], { status: 200 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabase.from("builder_addons") as any)
    .select("addon_slug, status, credits_remaining")
    .eq("builder_id", builderId)
    .eq("status", "active");

  return NextResponse.json(data ?? []);
}
