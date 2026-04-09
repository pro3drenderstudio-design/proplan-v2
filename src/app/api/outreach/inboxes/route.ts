import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { encrypt } from "@/lib/outreach/crypto";
import { verifySmtpCredentials } from "@/lib/outreach/smtp";

function supabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

// Columns safe to return to the client (no encrypted tokens)
const SAFE_COLUMNS = "id,label,provider,email_address,smtp_host,imap_host,daily_send_limit,send_window_start,send_window_end,timezone,signature,warmup_enabled,warmup_current_daily,warmup_target_daily,warmup_ramp_per_week,status,last_error,gmail_watch_expiry,ms_subscription_expiry,created_at,updated_at,oauth_refresh_token";

export async function GET() {
  const db = supabase();
  const { data, error } = await db
    .from("outreach_inboxes")
    .select(SAFE_COLUMNS)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Transform: replace raw oauth_refresh_token with a safe boolean
  const safe = (data ?? []).map(({ oauth_refresh_token, ...rest }) => ({
    ...rest,
    has_oauth: !!oauth_refresh_token,
  }));
  return NextResponse.json(safe);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { provider, label, email_address, smtp_host, smtp_port, smtp_user, smtp_pass,
          imap_host, imap_port, daily_send_limit, send_window_start, send_window_end,
          timezone, signature } = body;

  if (!provider || !label || !email_address) {
    return NextResponse.json({ error: "provider, label, and email_address are required" }, { status: 400 });
  }

  if (provider !== "smtp") {
    return NextResponse.json({ error: "Use OAuth routes for Gmail/Outlook" }, { status: 400 });
  }

  // Validate SMTP before saving
  const testInbox = {
    id: "", label, provider, email_address,
    smtp_host, smtp_port: smtp_port ?? 587, smtp_user,
    smtp_pass_encrypted: smtp_pass ? encrypt(smtp_pass) : null,
    imap_host, imap_port,
    daily_send_limit: daily_send_limit ?? 50,
    send_window_start: send_window_start ?? "09:00",
    send_window_end:   send_window_end   ?? "17:00",
    timezone:    timezone    ?? "America/New_York",
    warmup_enabled: false, warmup_current_daily: 0,
    warmup_target_daily: 50, warmup_ramp_per_week: 5,
    status: "active" as const,
    created_at: "", updated_at: "",
  };

  const valid = await verifySmtpCredentials(testInbox);
  if (!valid) {
    return NextResponse.json({ error: "SMTP credentials could not be verified. Check host, port, username and password." }, { status: 400 });
  }

  const db = supabase();
  const { data, error } = await db
    .from("outreach_inboxes")
    .insert({
      label, provider, email_address,
      smtp_host, smtp_port: smtp_port ?? 587,
      smtp_user,
      smtp_pass_encrypted: smtp_pass ? encrypt(smtp_pass) : null,
      imap_host, imap_port,
      daily_send_limit: daily_send_limit ?? 50,
      send_window_start: send_window_start ?? "09:00",
      send_window_end:   send_window_end   ?? "17:00",
      timezone:    timezone    ?? "America/New_York",
      signature,
      status: "active",
    })
    .select(SAFE_COLUMNS)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
