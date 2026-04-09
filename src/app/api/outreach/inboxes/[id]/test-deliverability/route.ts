import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendGmailMessage } from "@/lib/outreach/gmail";
import { sendMicrosoftMessage } from "@/lib/outreach/microsoft";
import { sendSmtpMessage } from "@/lib/outreach/smtp";
import type { OutreachInbox } from "@/types/outreach";

function supabase() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const adminEmail = process.env.ADMIN_EMAIL;
  if (!adminEmail) {
    return NextResponse.json({ error: "ADMIN_EMAIL env var not set" }, { status: 400 });
  }

  const db = supabase();
  const { data: inbox, error } = await db
    .from("outreach_inboxes")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !inbox) {
    return NextResponse.json({ error: "Inbox not found" }, { status: 404 });
  }

  const now = new Date().toLocaleString();
  const subject = `[Deliverability Test] ${inbox.email_address} — ${now}`;
  const htmlBody = `<p>This is a deliverability test email sent from <strong>${inbox.email_address}</strong> at ${now}.</p><p>If you received this in your inbox, deliverability is working correctly.</p>`;
  const textBody = `Deliverability test email from ${inbox.email_address} at ${now}. If you received this in your inbox, deliverability is working correctly.`;

  try {
    if (inbox.provider === "gmail") {
      await sendGmailMessage(inbox as OutreachInbox, { to: adminEmail, subject, htmlBody, textBody });
    } else if (inbox.provider === "outlook") {
      await sendMicrosoftMessage(inbox as OutreachInbox, { to: adminEmail, subject, htmlBody, textBody });
    } else {
      await sendSmtpMessage(inbox as OutreachInbox, { to: adminEmail, subject, htmlBody, textBody });
    }

    return NextResponse.json({ message: `Test email sent to ${adminEmail} — check your inbox (and spam folder).` });
  } catch (err) {
    return NextResponse.json({ error: String(err instanceof Error ? err.message : err) }, { status: 500 });
  }
}
