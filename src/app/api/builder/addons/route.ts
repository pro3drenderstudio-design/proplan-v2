import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: NextRequest) {
  const builderId = req.nextUrl.searchParams.get("builderId");
  if (!builderId) return NextResponse.json([], { status: 200 });

  const details = req.nextUrl.searchParams.get("details") === "1";

  if (details) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (supabase.from("builder_addons") as any)
      .select("addon_slug, status, credits_remaining, addons(name, included_units, unit_label, monthly_price_cents)")
      .eq("builder_id", builderId)
      .eq("status", "active");

    // Flatten the nested addons join
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rows = (data ?? []).map((row: any) => ({
      addon_slug:        row.addon_slug,
      status:            row.status,
      credits_remaining: row.credits_remaining,
      name:              row.addons?.name              ?? row.addon_slug,
      included_units:    row.addons?.included_units    ?? null,
      unit_label:        row.addons?.unit_label        ?? null,
      monthly_price_cents: row.addons?.monthly_price_cents ?? 0,
    }));
    return NextResponse.json(rows);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabase.from("builder_addons") as any)
    .select("addon_slug, status, credits_remaining")
    .eq("builder_id", builderId)
    .eq("status", "active");

  return NextResponse.json(data ?? []);
}
