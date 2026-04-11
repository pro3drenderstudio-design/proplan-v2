/**
 * Debug endpoint — returns exactly what the warmup reply loop sees at runtime.
 * Never sends anything. Use to diagnose why replies aren't firing.
 * GET /api/outreach/warmup/debug
 */
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function supabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

export async function GET() {
  const db  = supabase();
  const now = new Date();

  // ── 1. Active warmup pool ────────────────────────────────────────────────
  const { data: pool, error: poolErr } = await db
    .from("outreach_inboxes")
    .select("id, label, email_address, status, warmup_enabled, warmup_current_daily, provider")
    .eq("status", "active")
    .eq("warmup_enabled", true);

  // ── 2. All sends — unreplied, within the reply window ───────────────────
  const replyOldest = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const replyNewest = new Date(now.getTime() - 30 * 60 * 1000);

  const { data: pending, error: pendingErr } = await db
    .from("outreach_warmup_sends")
    .select("id, from_inbox_id, to_inbox_id, subject, sent_at, replied_at, thread_id, message_id")
    .gte("sent_at", replyOldest.toISOString())
    .lte("sent_at", replyNewest.toISOString())
    .is("replied_at", null);

  // ── 3. Sends too recent (< 30 min) — excluded from reply window ─────────
  const { data: tooRecent } = await db
    .from("outreach_warmup_sends")
    .select("id, sent_at, replied_at")
    .gte("sent_at", replyNewest.toISOString())
    .is("replied_at", null);

  // ── 4. Already replied ───────────────────────────────────────────────────
  const { data: alreadyReplied } = await db
    .from("outreach_warmup_sends")
    .select("id, sent_at, replied_at")
    .gte("sent_at", replyOldest.toISOString())
    .not("replied_at", "is", null);

  // ── 5. Inbox lookup for pending sends ───────────────────────────────────
  const inboxIds = [...new Set([
    ...(pending ?? []).map((s) => s.from_inbox_id),
    ...(pending ?? []).map((s) => s.to_inbox_id),
  ].filter(Boolean))];

  const { data: inboxRows } = inboxIds.length > 0
    ? await db.from("outreach_inboxes").select("id, label, email_address, status, warmup_enabled, provider").in("id", inboxIds)
    : { data: [] };

  const inboxMap = new Map((inboxRows ?? []).map((r) => [r.id, r]));

  // ── 6. Annotate each pending send with skip reason ───────────────────────
  const annotated = (pending ?? []).map((s) => {
    const recipient = inboxMap.get(s.to_inbox_id);
    const sender    = inboxMap.get(s.from_inbox_id);
    let skipReason: string | null = null;
    if (!recipient)                          skipReason = "recipient inbox not found in DB";
    else if (!sender)                        skipReason = "sender inbox not found in DB";
    else if (recipient.status !== "active")  skipReason = `recipient status = ${recipient.status}`;
    else if (sender.status !== "active")     skipReason = `sender status = ${sender.status}`;
    return {
      id:            s.id,
      subject:       s.subject,
      sent_at:       s.sent_at,
      from_inbox_id: s.from_inbox_id,
      to_inbox_id:   s.to_inbox_id,
      has_thread_id: !!s.thread_id,
      has_message_id: !!s.message_id,
      sender_email:    sender?.email_address ?? null,
      recipient_email: recipient?.email_address ?? null,
      skip_reason:   skipReason,
      eligible:      skipReason === null,
    };
  });

  return NextResponse.json({
    now:               now.toISOString(),
    reply_window: {
      oldest: replyOldest.toISOString(),
      newest: replyNewest.toISOString(),
    },
    pool: {
      count: pool?.length ?? 0,
      error: poolErr?.message ?? null,
      inboxes: pool ?? [],
    },
    pending_sends: {
      count:     pending?.length ?? 0,
      error:     pendingErr?.message ?? null,
      eligible:  annotated.filter((s) => s.eligible).length,
      sends:     annotated,
    },
    too_recent_sends: {
      count: tooRecent?.length ?? 0,
      note:  "These were sent < 30 min ago and are excluded from reply window",
    },
    already_replied: {
      count: alreadyReplied?.length ?? 0,
    },
  });
}
