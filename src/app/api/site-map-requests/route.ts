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
    .from("profiles")
    .select("builder_id")
    .eq("id", user.id)
    .single();
  return profile?.builder_id ?? null;
}

export async function GET() {
  const builderId = await getBuilderIdFromSession();
  if (!builderId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from("site_map_requests") as any)
    .select("*")
    .eq("builder_id", builderId)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  const builderId = await getBuilderIdFromSession();
  if (!builderId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json() as {
      community_name:      string;
      community_address?:  string | null;
      estimated_lot_count?: number | null;
      phases?:             number;
      style_notes?:        string | null;
      target_date?:        string | null;
    };

    if (!body.community_name?.trim()) {
      return NextResponse.json({ error: "community_name is required" }, { status: 400 });
    }

    // Fetch the setup fee from addons table
    const { data: addon } = await supabase
      .from("addons")
      .select("setup_fee_cents")
      .eq("slug", "site-maps")
      .single();

    const setupFeeCents = addon?.setup_fee_cents ?? 50000; // fallback $500

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: request, error } = await (supabase.from("site_map_requests") as any).insert({
      builder_id:           builderId,
      community_name:       body.community_name.trim(),
      community_address:    body.community_address  ?? null,
      estimated_lot_count:  body.estimated_lot_count ?? null,
      phases:               body.phases ?? 1,
      style_notes:          body.style_notes ?? null,
      target_date:          body.target_date ?? null,
      status:               "awaiting_payment",
      setup_fee_cents:      setupFeeCents,
    }).select("id, setup_fee_cents").single();

    if (error) {
      console.error("POST /api/site-map-requests:", error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(request, { status: 201 });
  } catch (err) {
    console.error("POST /api/site-map-requests error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
