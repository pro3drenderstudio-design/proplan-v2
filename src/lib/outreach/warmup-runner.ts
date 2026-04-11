/**
 * Core warmup pool runner.
 * Sends warmup emails between active warmup-enabled inboxes,
 * then replies to ~40% of recent warmup emails received.
 *
 * Called directly from the cron route as a fallback when Inngest is not
 * configured, and from the Inngest outreach-warmup-pool function.
 */

import { createClient } from "@supabase/supabase-js";
import { sendGmailMessage, rescueFromSpam } from "@/lib/outreach/gmail";
import { sendMicrosoftMessage } from "@/lib/outreach/microsoft";
import { sendSmtpMessage } from "@/lib/outreach/smtp";
import { selectSendTemplate, selectReplyTemplate } from "@/lib/outreach/warmup-templates";
import type { OutreachInbox } from "@/types/outreach";

const AUTH_ERROR_PATTERN =
  /invalid_grant|token.*expired|token.*revoked|access.*denied|unauthorized|authentication.*fail|auth.*fail|535|534|530|credentials|wrong.*password|password.*incorrect|account.*suspended|account.*disabled|login.*fail|AUTHENTICATIONFAILED|AUTH.*FAILED/i;

function supabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

export interface WarmupRunResult {
  sent:    number;
  skipped: number;
  replied: number;
  errors:  number;
}

// ─── Send warmup emails ───────────────────────────────────────────────────────

export async function runWarmupBatch(): Promise<WarmupRunResult> {
  const db = supabase();
  const result: WarmupRunResult = { sent: 0, skipped: 0, replied: 0, errors: 0 };

  const { data: pool } = await db
    .from("outreach_inboxes")
    .select("*")
    .eq("status", "active")
    .eq("warmup_enabled", true);

  if (!pool || pool.length < 2) {
    return result;
  }

  // Count sends already done today per inbox
  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);

  const { data: todayCounts } = await db
    .from("outreach_warmup_sends")
    .select("from_inbox_id")
    .gte("sent_at", todayStart.toISOString());

  const sentToday = new Map<string, number>();
  for (const row of todayCounts ?? []) {
    sentToday.set(row.from_inbox_id, (sentToday.get(row.from_inbox_id) ?? 0) + 1);
  }

  for (const sender of pool) {
    // If warmup_current_daily hasn't been set yet (0), seed it from the ramp value
    // so new inboxes start sending immediately rather than waiting for the Monday ramp.
    const effectiveDaily = sender.warmup_current_daily || sender.warmup_ramp_per_week || 1;
    // Spread sends evenly across the day. perRun = 1 so each cron run sends at most
    // one email per inbox, and the daily cap prevents over-sending regardless of
    // how frequently the cron fires.
    const perRun      = 1;
    const alreadySent = sentToday.get(sender.id) ?? 0;
    const remaining   = Math.max(0, effectiveDaily - alreadySent);
    const toSend      = Math.min(perRun, remaining);

    if (toSend === 0) {
      result.skipped++;
      continue;
    }

    const recipients = pool.filter((r) => r.id !== sender.id);
    if (!recipients.length) continue;

    for (let i = 0; i < toSend; i++) {
      const recipient = recipients[i % recipients.length];
      const seed = `${sender.id}-${recipient.id}-${Date.now()}-${i}`;
      const template = selectSendTemplate(seed);
      const warmupId = crypto.randomUUID();
      const warmupHeader = { "X-PP-Ref": warmupId };
      const htmlBody = `<!--pps-ref:${warmupId}--><p>${template.body.replace(/\n/g, "</p><p>")}</p>`;
      const textBody = template.body;

      let messageId    = "";
      let rfcMessageId = "";
      let threadId     = "";

      try {
        if (sender.provider === "gmail" && sender.oauth_refresh_token) {
          const res = await sendGmailMessage(sender as OutreachInbox, {
            to: recipient.email_address, subject: template.subject,
            htmlBody, textBody, customHeaders: warmupHeader,
          });
          messageId    = res.messageId;
          rfcMessageId = res.rfcMessageId;
          threadId     = res.threadId;

          // Move the email out of spam / promotions in the recipient's inbox
          // so Gmail builds positive engagement signals for this sender.
          rescueFromSpam(recipient as OutreachInbox, sender.email_address, template.subject)
            .catch((e) => console.warn("rescueFromSpam failed:", String(e)));

        } else if (sender.provider === "outlook" && sender.oauth_refresh_token) {
          const res = await sendMicrosoftMessage(sender as OutreachInbox, {
            to: recipient.email_address, subject: template.subject,
            htmlBody, textBody, customHeaders: warmupHeader,
          });
          messageId    = res.messageId;
          rfcMessageId = res.messageId;
          threadId     = res.threadId;
        } else {
          const res = await sendSmtpMessage(sender as OutreachInbox, {
            to: recipient.email_address, subject: template.subject,
            htmlBody, textBody, customHeaders: warmupHeader,
          });
          messageId    = res.messageId;
          rfcMessageId = res.messageId;
        }

        await db.from("outreach_warmup_sends").insert({
          id:             warmupId,
          from_inbox_id:  sender.id,
          to_inbox_id:    recipient.id,
          message_id:     rfcMessageId || messageId, // store RFC 2822 ID for reply threading
          thread_id:      threadId || messageId,
          subject:        template.subject,
          sent_at:        new Date().toISOString(),
        });

        result.sent++;
      } catch (err) {
        const errMsg = String(err);
        console.error(`Warmup send failed ${sender.email_address} → ${recipient.email_address}: ${errMsg}`);
        result.errors++;
        if (AUTH_ERROR_PATTERN.test(errMsg)) {
          await db.from("outreach_inboxes")
            .update({ status: "error", last_error: errMsg.slice(0, 500) })
            .eq("id", sender.id);
        }
      }
    }
  }

  // ── Reply to ~40% of recent warmup emails ────────────────────────────────────
  // Only reply to sends that are at least 30 minutes old — the email needs time
  // to actually arrive in the recipient's inbox before we can reply to it.
  // Intentionally avoid inline FK joins (PostgREST !hint syntax) because they
  // silently return null when FK constraints aren't formally declared on the
  // table. Fetch inbox rows separately and match in memory instead.
  const replyOldest = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const replyNewest = new Date(Date.now() - 30 * 60 * 1000);
  const { data: pending } = await db
    .from("outreach_warmup_sends")
    .select("id, from_inbox_id, to_inbox_id, subject, thread_id, message_id")
    .gte("sent_at", replyOldest.toISOString())
    .lte("sent_at", replyNewest.toISOString())
    .is("replied_at", null);

  if (pending && pending.length > 0) {
    // Collect all unique inbox IDs referenced by the pending sends
    const inboxIds = [...new Set([
      ...pending.map((s) => s.from_inbox_id),
      ...pending.map((s) => s.to_inbox_id),
    ].filter(Boolean))];

    const { data: inboxRows } = await db
      .from("outreach_inboxes")
      .select("*")
      .in("id", inboxIds);

    const inboxMap = new Map<string, OutreachInbox>(
      (inboxRows ?? []).map((r) => [r.id, r as OutreachInbox])
    );

    for (const warmupSend of pending) {
      if (Math.random() > 0.4) continue;

      const recipientInbox = inboxMap.get(warmupSend.to_inbox_id);
      const senderInbox    = inboxMap.get(warmupSend.from_inbox_id);
      if (!recipientInbox || !senderInbox) continue;
      // Skip if either inbox is no longer active / enabled
      if (recipientInbox.status !== "active") continue;
      if (senderInbox.status !== "active") continue;

      const seed         = `reply-${warmupSend.id}`;
      const replyTpl     = selectReplyTemplate(seed);
      const replyId      = crypto.randomUUID();
      const replySubject = warmupSend.subject ? `Re: ${warmupSend.subject}` : "Re: (no subject)";
      const htmlBody     = `<!--pps-ref:${replyId}--><p>${replyTpl.body}</p>`;

      try {
        if (recipientInbox.provider === "gmail" && recipientInbox.oauth_refresh_token) {
          await sendGmailMessage(recipientInbox as OutreachInbox, {
            to: senderInbox.email_address, subject: replySubject,
            htmlBody, textBody: replyTpl.body,
            replyToThreadId: warmupSend.thread_id ?? undefined,
            inReplyToMessageId: warmupSend.message_id ?? undefined,
            customHeaders: { "X-PP-Ref": replyId },
          });
        } else if (recipientInbox.provider === "outlook" && recipientInbox.oauth_refresh_token) {
          await sendMicrosoftMessage(recipientInbox as OutreachInbox, {
            to: senderInbox.email_address, subject: replySubject,
            htmlBody, textBody: replyTpl.body,
            replyToThreadId: warmupSend.thread_id ?? undefined,
            inReplyToMessageId: warmupSend.message_id ?? undefined,
            customHeaders: { "X-PP-Ref": replyId },
          });
        } else {
          await sendSmtpMessage(recipientInbox as OutreachInbox, {
            to: senderInbox.email_address, subject: replySubject,
            htmlBody, textBody: replyTpl.body,
            inReplyToMessageId: warmupSend.message_id ?? undefined,
            customHeaders: { "X-PP-Ref": replyId },
          });
        }

        await db.from("outreach_warmup_sends")
          .update({ replied_at: new Date().toISOString() })
          .eq("id", warmupSend.id);

        result.replied++;
      } catch (err) {
        const msg = String(err);
        console.error(`Warmup reply failed ${recipientInbox.email_address} → ${senderInbox.email_address}: ${msg}`);
        result.errors++;
        if (AUTH_ERROR_PATTERN.test(msg)) {
          await db.from("outreach_inboxes")
            .update({ status: "error", last_error: msg.slice(0, 500) })
            .eq("id", recipientInbox.id);
        }
      }
    }
  }

  return result;
}
