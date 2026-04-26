/**
 * POST /api/portal/save — persist a buyer's configuration and return a shareable token
 * Body: { project_id, lead_id?, configuration, total_price, phase_snapshot?, lot_id? }
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

function supabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { project_id, lead_id, configuration, total_price, phase_snapshot, lot_id, thumbnail_url } = body;

  if (!project_id || !configuration || total_price == null) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const token = crypto.randomBytes(16).toString("hex");
  const db = supabase();

  const { data, error } = await db
    .from("saved_configurations")
    .insert({
      project_id,
      lead_id: lead_id ?? null,
      token,
      configuration,
      total_price,
      phase_snapshot: phase_snapshot ?? null,
      lot_id: lot_id ?? null,
      thumbnail_url: thumbnail_url ?? null,
    })
    .select("id, token")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ token: data.token, id: data.id });
}
