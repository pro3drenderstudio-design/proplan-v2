import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { fetchNewMessages } from "@/lib/outreach/gmail";
import { markEnrollmentReplied } from "@/lib/outreach/scheduler";

function supabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

export async function POST(req: NextRequest) {
  const body = await req.json();

  // Google Pub/Sub push format
  const messageData = body?.message?.data;
  if (!messageData) return NextResponse.json({ ok: true });

  let parsed: { emailAddress?: string; historyId?: string };
  try {
    parsed = JSON.parse(Buffer.from(messageData, "base64").toString("utf8"));
  } catch {
    return NextResponse.json({ ok: true });
  }

  const { emailAddress, historyId } = parsed;
  if (!emailAddress || !historyId) return NextResponse.json({ ok: true });

  const db = supabase();

  const { data: inbox } = await db
    .from("outreach_inboxes")
    .select("*")
    .eq("email_address", emailAddress)
    .eq("provider", "gmail")
    .single();

  if (!inbox?.gmail_history_id) return NextResponse.json({ ok: true });

  // Fetch messages added since last known historyId
  const replies = await fetchNewMessages(inbox, inbox.gmail_history_id).catch(() => []);

  for (const reply of replies) {
    // ── Warmup check: skip CRM if this is a warmup email ───────────────────
    if (reply.warmupId) {
      await db
        .from("outreach_warmup_sends")
        .update({ replied_at: new Date().toISOString() })
        .eq("id", reply.warmupId)
        .is("replied_at", null);
      continue;
    }

    // Also check by thread_id (fallback)
    const { data: warmupByThread } = await db
      .from("outreach_warmup_sends")
      .select("id")
      .eq("thread_id", reply.threadId)
      .limit(1)
      .single();

    if (warmupByThread) continue;

    // Regular CRM reply
    const { data: send } = await db
      .from("outreach_sends")
      .select("id, enrollment_id")
      .eq("thread_id", reply.threadId)
      .is("replied_at", null)
      .single();

    if (send) {
      await markEnrollmentReplied(send.enrollment_id, send.id);
    }
  }

  return NextResponse.json({ ok: true });
}
