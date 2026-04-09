import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { encrypt } from "@/lib/outreach/crypto";

function supabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

const SAFE_COLUMNS = "id,label,provider,email_address,daily_send_limit,send_window_start,send_window_end,timezone,signature,warmup_enabled,warmup_current_daily,warmup_target_daily,warmup_ramp_per_week,status,last_error,gmail_watch_expiry,ms_subscription_expiry,created_at,updated_at";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();

  const allowed = [
    "label", "daily_send_limit", "send_window_start", "send_window_end",
    "timezone", "signature", "warmup_enabled", "warmup_target_daily",
    "warmup_ramp_per_week", "status",
  ];

  const updates: Record<string, unknown> = {};
  for (const key of allowed) {
    if (key in body) updates[key] = body[key];
  }

  // Allow updating SMTP password (re-encrypt)
  if (body.smtp_pass) {
    updates.smtp_pass_encrypted = encrypt(body.smtp_pass);
  }

  const db = supabase();
  const { data, error } = await db
    .from("outreach_inboxes")
    .update(updates)
    .eq("id", id)
    .select(SAFE_COLUMNS)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = supabase();
  const { error } = await db.from("outreach_inboxes").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
