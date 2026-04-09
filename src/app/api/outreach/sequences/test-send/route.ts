import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { renderEmail } from "@/lib/outreach/template";
import { sendGmailMessage } from "@/lib/outreach/gmail";
import { sendMicrosoftMessage } from "@/lib/outreach/microsoft";
import { sendSmtpMessage } from "@/lib/outreach/smtp";
import type { OutreachInbox } from "@/types/outreach";

function supabase() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

export async function POST(req: NextRequest) {
  const {
    inbox_id,
    to_email,
    subject_template,
    body_template,
    lead_id,           // optional — pull variables from a real lead
    variables = {},    // manual variable overrides
  } = await req.json();

  if (!inbox_id || !to_email || !subject_template || !body_template) {
    return NextResponse.json({ error: "inbox_id, to_email, subject_template, and body_template are required" }, { status: 400 });
  }

  const db = supabase();

  const { data: inbox, error: inboxErr } = await db
    .from("outreach_inboxes")
    .select("*")
    .eq("id", inbox_id)
    .single();

  if (inboxErr || !inbox) return NextResponse.json({ error: "Inbox not found" }, { status: 404 });

  // Build a fake lead for rendering
  let lead: Record<string, unknown> = {
    id: "test", list_id: null, email: to_email,
    first_name: variables.first_name ?? "Test",
    last_name:  variables.last_name  ?? "Lead",
    company:    variables.company    ?? "Acme Corp",
    title:      variables.title      ?? "Manager",
    website:    variables.website    ?? "",
    custom_fields: variables.custom_fields ?? {},
    status: "active", created_at: new Date().toISOString(),
  };

  // If lead_id given, load real lead
  if (lead_id) {
    const { data: realLead } = await db.from("outreach_leads").select("*").eq("id", lead_id).single();
    if (realLead) lead = { ...realLead, ...Object.fromEntries(Object.entries(variables).filter(([, v]) => v)) };
  }

  const rendered = renderEmail({
    subjectTemplate: subject_template,
    bodyTemplate:    body_template,
    lead:            lead as never,
    sendId:          "test-send",
    signature:       inbox.signature,
    trackOpens:      false,
    trackClicks:     false,
  });

  const opts = { to: to_email, subject: rendered.subject, htmlBody: rendered.body, textBody: rendered.textBody };
  try {
    if (inbox.provider === "gmail" && inbox.oauth_refresh_token) {
      await sendGmailMessage(inbox as OutreachInbox, opts);
    } else if (inbox.provider === "outlook" && inbox.oauth_refresh_token) {
      await sendMicrosoftMessage(inbox as OutreachInbox, opts);
    } else {
      await sendSmtpMessage(inbox as OutreachInbox, opts);
    }
    return NextResponse.json({ message: `Test email sent to ${to_email}` });
  } catch (err) {
    return NextResponse.json({ error: String(err instanceof Error ? err.message : err) }, { status: 500 });
  }
}
