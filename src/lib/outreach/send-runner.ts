/**
 * Core outreach send loop.
 * Distributes due enrollments round-robin across all active inboxes on the
 * campaign, respecting each inbox's daily send limit.
 *
 * Example: 20 enrollments, 4 inboxes with capacity 5 each → 5 sends per inbox.
 */

import { createClient } from "@supabase/supabase-js";
import { getDueEnrollments, checkDailyLimits, advanceEnrollment, computeNextSendAt } from "@/lib/outreach/scheduler";
import { renderEmail } from "@/lib/outreach/template";
import { sendGmailMessage } from "@/lib/outreach/gmail";
import { sendMicrosoftMessage } from "@/lib/outreach/microsoft";
import { sendSmtpMessage } from "@/lib/outreach/smtp";
import type { OutreachInbox, OutreachSequenceStep, OutreachCampaign } from "@/types/outreach";

const BOUNCE_PATTERN = /5\d\d|user unknown|mailbox not found|no such user|does not exist|invalid.*address|recipient.*rejected/i;
const AUTH_ERROR_PATTERN = /invalid_grant|token.*expired|token.*revoked|access.*denied|unauthorized|authentication.*fail|auth.*fail|535|534|530|credentials|wrong.*password|password.*incorrect|account.*suspended|account.*disabled|login.*fail|AUTHENTICATIONFAILED|AUTH.*FAILED/i;

function supabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

export interface SendRunResult {
  processed: number;
  sent:      number;
  skipped:   number;
  errors:    number;
}

// ─── Inbox pool for a campaign ────────────────────────────────────────────────

interface InboxSlot {
  inbox:     OutreachInbox;
  remaining: number;   // sends still available today
  used:      number;   // sends assigned in this run
}

async function buildInboxPool(db: ReturnType<typeof supabase>, campaign: OutreachCampaign): Promise<InboxSlot[]> {
  const inboxIds = campaign.inbox_ids ?? [];
  if (!inboxIds.length) return [];

  const { data: rows } = await db
    .from("outreach_inboxes")
    .select("*")
    .in("id", inboxIds)
    .eq("status", "active");

  const slots: InboxSlot[] = [];
  for (const row of rows ?? []) {
    const remaining = await checkDailyLimits(row.id, row.daily_send_limit);
    if (remaining > 0) slots.push({ inbox: row as OutreachInbox, remaining, used: 0 });
  }
  return slots;
}

/** Round-robin: pick the inbox with the most remaining capacity that still has room. */
function pickInbox(slots: InboxSlot[], rrIndex: number): { slot: InboxSlot; nextRr: number } | null {
  const n = slots.length;
  for (let i = 0; i < n; i++) {
    const slot = slots[(rrIndex + i) % n];
    if (slot.used < slot.remaining) {
      return { slot, nextRr: (rrIndex + i + 1) % n };
    }
  }
  return null; // all inboxes at capacity
}

// ─── Main runner ──────────────────────────────────────────────────────────────

export async function runSendBatch(
  limit    = 20,
  minDelay = 2_000,
  maxDelay = 5_000,
): Promise<SendRunResult> {
  const due = await getDueEnrollments(limit);
  const result: SendRunResult = { processed: due.length, sent: 0, skipped: 0, errors: 0 };
  if (!due.length) return result;

  const db = supabase();

  // Load footer settings once per batch
  const { data: settingsRows } = await db.from("outreach_settings").select("key, value");
  const settings: Record<string, string> = {};
  for (const row of settingsRows ?? []) settings[row.key] = row.value ?? "";
  const footerEnabled = settings.footer_enabled !== "false";
  const footerText    = settings.footer_custom_text || undefined;
  const footerAddress = settings.footer_address || undefined;

  // Group due items by campaign so we build one inbox pool per campaign
  const byCampaign = new Map<string, { items: typeof due; slots: InboxSlot[]; rrIdx: number }>();
  for (const item of due) {
    const cid = item.campaign.id;
    if (!byCampaign.has(cid)) {
      const slots = await buildInboxPool(db, item.campaign);
      byCampaign.set(cid, { items: [], slots, rrIdx: 0 });
    }
    byCampaign.get(cid)!.items.push(item);
  }

  // Process each campaign's due enrollments
  for (const { items, slots, rrIdx: startRr } of byCampaign.values()) {
    if (!slots.length) { result.skipped += items.length; continue; }

    let rr = startRr;

    for (const { enrollment, campaign, step: seqStep } of items) {
      // ── Pick next inbox (round-robin) ────────────────────────────────────────
      const pick = pickInbox(slots, rr);
      if (!pick) { result.skipped++; continue; } // all inboxes at daily cap
      const { slot } = pick;
      rr = pick.nextRr;
      slot.used++;

      // ── Wait step ────────────────────────────────────────────────────────────
      if (seqStep.type === "wait") {
        const nextSendAt = computeNextSendAt(seqStep.wait_days, campaign);
        const { data: nextStep } = await db
          .from("outreach_sequences").select("*")
          .eq("campaign_id", campaign.id)
          .eq("step_order", seqStep.step_order + 1)
          .single();
        await advanceEnrollment(enrollment.id, seqStep.step_order + 1, nextSendAt, !nextStep);
        result.skipped++;
        continue;
      }

      // ── Lead ─────────────────────────────────────────────────────────────────
      const { data: lead } = await db.from("outreach_leads").select("*").eq("id", enrollment.lead_id).single();
      if (!lead) { result.skipped++; continue; }

      // ── Unsubscribe check ─────────────────────────────────────────────────────
      const { data: unsub } = await db.from("outreach_unsubscribes").select("id").eq("email", lead.email.toLowerCase()).single();
      if (unsub) {
        await db.from("outreach_enrollments").update({ status: "unsubscribed" }).eq("id", enrollment.id);
        result.skipped++;
        continue;
      }

      // ── Blacklist domain ──────────────────────────────────────────────────────
      const domain = lead.email.split("@")[1]?.toLowerCase();
      if (domain) {
        const { data: blocked } = await db.from("outreach_blacklist_domains").select("id").eq("domain", domain).single();
        if (blocked) { result.skipped++; continue; }
      }

      // ── Pause after open ──────────────────────────────────────────────────────
      if (campaign.pause_after_open) {
        const { data: openedSend } = await db
          .from("outreach_sends").select("id")
          .eq("enrollment_id", enrollment.id).not("opened_at", "is", null)
          .limit(1).single();
        if (openedSend) { result.skipped++; continue; }
      }

      // ── A/B subject ───────────────────────────────────────────────────────────
      const abVariant: "a" | "b" = enrollment.ab_variant ?? "a";
      const subjectTemplate =
        abVariant === "b" && seqStep.subject_template_b
          ? seqStep.subject_template_b
          : (seqStep.subject_template ?? "");

      // ── Create send record ────────────────────────────────────────────────────
      const { data: sendRecord } = await db
        .from("outreach_sends")
        .insert({
          enrollment_id:    enrollment.id,
          sequence_step_id: seqStep.id,
          inbox_id:         slot.inbox.id,
          to_email:         lead.email,
          subject:          subjectTemplate,
          body:             seqStep.body_template ?? "",
          status:           "queued",
        })
        .select("id")
        .single();

      if (!sendRecord) { result.errors++; continue; }

      const rendered = renderEmail({
        subjectTemplate,
        bodyTemplate:    seqStep.body_template ?? "",
        lead,
        sendId:          sendRecord.id,
        signature:       slot.inbox.signature,
        trackOpens:      campaign.track_opens,
        trackClicks:     campaign.track_clicks,
        footerEnabled,
        footerText,
        physicalAddress: footerAddress,
      });

      if (rendered.trackedLinks.length) {
        await db.from("outreach_tracked_links").insert(
          rendered.trackedLinks.map((l) => ({ send_id: sendRecord.id, ...l })),
        );
      }

      await db.from("outreach_sends")
        .update({ subject: rendered.subject, body: rendered.body })
        .eq("id", sendRecord.id);

      // ── Send ──────────────────────────────────────────────────────────────────
      try {
        const sendResult = await sendViaInbox(slot.inbox, {
          to:       lead.email,
          subject:  rendered.subject,
          htmlBody: rendered.body,
          textBody: rendered.textBody,
        });

        await db.from("outreach_sends").update({
          status:     "sent",
          sent_at:    new Date().toISOString(),
          message_id: sendResult.messageId.replace(/^<|>$/g, ""),
          thread_id:  sendResult.threadId ?? null,
        }).eq("id", sendRecord.id);

        result.sent++;
      } catch (err) {
        const errMsg = String(err);
        if (BOUNCE_PATTERN.test(errMsg)) {
          await db.from("outreach_sends").update({ status: "bounced", bounced_at: new Date().toISOString() }).eq("id", sendRecord.id);
          await db.from("outreach_enrollments").update({ status: "bounced" }).eq("id", enrollment.id);
          await db.from("outreach_leads").update({ status: "bounced" }).eq("id", lead.id);
        } else {
          console.error(`Send failed for ${lead.email} via ${slot.inbox.email_address}: ${errMsg}`);
          await db.from("outreach_sends").update({ status: "failed" }).eq("id", sendRecord.id);
          const inboxPatch: Record<string, unknown> = { last_error: errMsg.slice(0, 500) };
          if (AUTH_ERROR_PATTERN.test(errMsg)) {
            inboxPatch.status = "error";
          }
          await db.from("outreach_inboxes").update(inboxPatch).eq("id", slot.inbox.id);
        }
        result.errors++;
        continue;
      }

      // ── Advance enrollment ────────────────────────────────────────────────────
      const { data: nextStep } = await db
        .from("outreach_sequences").select("*")
        .eq("campaign_id", campaign.id)
        .eq("step_order", seqStep.step_order + 1)
        .single();

      if (nextStep) {
        const nextSendAt = computeNextSendAt((nextStep as OutreachSequenceStep).wait_days, campaign);
        await advanceEnrollment(enrollment.id, (nextStep as OutreachSequenceStep).step_order, nextSendAt, false);
      } else {
        await advanceEnrollment(enrollment.id, seqStep.step_order + 1, null, true);
      }

      // ── Natural pacing delay ──────────────────────────────────────────────────
      const delay = minDelay + Math.random() * (maxDelay - minDelay);
      await new Promise((r) => setTimeout(r, delay));
    }
  }

  return result;
}

// ─── sendViaInbox ─────────────────────────────────────────────────────────────

async function sendViaInbox(
  inbox: OutreachInbox,
  opts: { to: string; subject: string; htmlBody: string; textBody: string },
): Promise<{ messageId: string; threadId?: string }> {
  if (inbox.provider === "gmail" && inbox.oauth_refresh_token) {
    return sendGmailMessage(inbox, opts);
  }
  if (inbox.provider === "outlook" && inbox.oauth_refresh_token) {
    return sendMicrosoftMessage(inbox, opts);
  }
  const r = await sendSmtpMessage(inbox, opts);
  return { messageId: r.messageId };
}
