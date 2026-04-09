import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendGmailMessage } from "@/lib/outreach/gmail";
import { sendSmtpMessage } from "@/lib/outreach/smtp";
import type { OutreachInbox } from "@/types/outreach";

function supabase() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ enrollmentId: string }> },
) {
  const { enrollmentId } = await params;
  const { body } = await req.json() as { body: string };

  if (!body?.trim()) {
    return NextResponse.json({ error: "body is required" }, { status: 400 });
  }

  const db = supabase();

  // Fetch the latest send for this enrollment to get inbox + thread context
  const { data: send, error: sendErr } = await db
    .from("outreach_sends")
    .select("id, inbox_id, to_email, subject, message_id, thread_id")
    .eq("enrollment_id", enrollmentId)
    .order("sent_at", { ascending: false })
    .limit(1)
    .single();

  if (sendErr || !send) {
    return NextResponse.json({ error: "No send found for this enrollment" }, { status: 404 });
  }

  // Fetch the inbox (with encrypted tokens)
  const { data: inbox, error: inboxErr } = await db
    .from("outreach_inboxes")
    .select("*")
    .eq("id", send.inbox_id)
    .single();

  if (inboxErr || !inbox) {
    return NextResponse.json({ error: "Inbox not found" }, { status: 404 });
  }

  const subject = send.subject?.startsWith("Re:") ? send.subject : `Re: ${send.subject ?? ""}`;
  const htmlBody = body.replace(/\n/g, "<br>");
  const textBody = body;

  try {
    if (inbox.provider === "gmail" && inbox.oauth_refresh_token) {
      await sendGmailMessage(inbox as OutreachInbox, {
        to: send.to_email,
        subject,
        htmlBody,
        textBody,
        replyToThreadId: send.thread_id ?? undefined,
        inReplyToMessageId: send.message_id ?? undefined,
      });
    } else if (inbox.provider === "smtp" || inbox.smtp_host) {
      await sendSmtpMessage(inbox as OutreachInbox, {
        to: send.to_email,
        subject,
        htmlBody,
        textBody,
        inReplyToMessageId: send.message_id ?? undefined,
      });
    } else {
      return NextResponse.json({ error: "Inbox provider not supported or not connected" }, { status: 400 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
