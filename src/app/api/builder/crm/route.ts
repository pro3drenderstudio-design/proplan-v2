import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: NextRequest) {
  const builderId = req.nextUrl.searchParams.get("builderId");
  if (!builderId) return NextResponse.json({ error: "builderId required" }, { status: 400 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabase.from("crm_integrations") as any)
    .select("crm_type,api_key,webhook_url,portal_id,enabled,last_sync_at")
    .eq("builder_id", builderId)
    .single();

  return NextResponse.json(data ?? null);
}

export async function POST(req: NextRequest) {
  const body = await req.json() as {
    builderId:    string;
    crm_type:     string;
    api_key?:     string | null;
    webhook_url?: string | null;
    portal_id?:   string | null;
    enabled?:     boolean;
  };

  if (!body.builderId || !body.crm_type) {
    return NextResponse.json({ error: "builderId and crm_type required" }, { status: 400 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.from("crm_integrations") as any).upsert({
    builder_id:  body.builderId,
    crm_type:    body.crm_type,
    api_key:     body.api_key     ?? null,
    webhook_url: body.webhook_url ?? null,
    portal_id:   body.portal_id   ?? null,
    enabled:     body.enabled     ?? true,
  }, { onConflict: "builder_id" });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const builderId = req.nextUrl.searchParams.get("builderId");
  if (!builderId) return NextResponse.json({ error: "builderId required" }, { status: 400 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase.from("crm_integrations") as any).delete().eq("builder_id", builderId);
  return NextResponse.json({ ok: true });
}
