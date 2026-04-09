import { createClient } from "@supabase/supabase-js";
import { inngest } from "@/lib/inngest";
import { sendGmailMessage } from "@/lib/outreach/gmail";
import { sendMicrosoftMessage } from "@/lib/outreach/microsoft";
import { sendSmtpMessage } from "@/lib/outreach/smtp";
import { selectSendTemplate, selectReplyTemplate } from "@/lib/outreach/warmup-templates";
import type { OutreachInbox } from "@/types/outreach";

function supabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

export const outreachWarmupPool = inngest.createFunction(
  {
    id:       "outreach-warmup-pool",
    name:     "Outreach: Warmup Pool Exchange",
    triggers: [{ cron: "0 */4 * * *" }],
  },
  async ({ step }) => {
    // ── Step A: Send warmup emails ────────────────────────────────────────────
    await step.run("warmup-send", async () => {
      const db = supabase();

      const { data: pool } = await db
        .from("outreach_inboxes")
        .select("*")
        .eq("status", "active")
        .eq("warmup_enabled", true);

      if (!pool || pool.length < 2) {
        console.log("Warmup pool too small (need ≥2 inboxes)");
        return;
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
        const perRun = Math.max(1, Math.floor(sender.warmup_current_daily / 6));
        const alreadySent = sentToday.get(sender.id) ?? 0;
        const remaining = Math.max(0, sender.warmup_current_daily - alreadySent);
        const toSend = Math.min(perRun, remaining);
        if (toSend === 0) continue;

        // Pick recipients — other pool inboxes, not self
        const recipients = pool.filter((r) => r.id !== sender.id);
        if (!recipients.length) continue;

        for (let i = 0; i < toSend; i++) {
          const recipient = recipients[i % recipients.length];
          const seed = `${sender.id}-${recipient.id}-${Date.now()}`;
          const template = selectSendTemplate(seed);
          const warmupId = crypto.randomUUID();
          const warmupHeader = { "X-PP-Ref": warmupId };
          const htmlBody = `<!--pps-ref:${warmupId}--><p>${template.body.replace(/\n/g, "</p><p>")}</p>`;
          const textBody = template.body;

          let messageId = "";
          let threadId  = "";

          try {
            if (sender.provider === "gmail" && sender.oauth_refresh_token) {
              const res = await sendGmailMessage(sender as OutreachInbox, {
                to:            recipient.email_address,
                subject:       template.subject,
                htmlBody,
                textBody,
                customHeaders: warmupHeader,
              });
              messageId = res.messageId;
              threadId  = res.threadId;
            } else if (sender.provider === "outlook" && sender.oauth_refresh_token) {
              const res = await sendMicrosoftMessage(sender as OutreachInbox, {
                to:            recipient.email_address,
                subject:       template.subject,
                htmlBody,
                textBody,
                customHeaders: warmupHeader,
              });
              messageId = res.messageId;
              threadId  = res.threadId;
            } else {
              const res = await sendSmtpMessage(sender as OutreachInbox, {
                to:            recipient.email_address,
                subject:       template.subject,
                htmlBody,
                textBody,
                customHeaders: warmupHeader,
              });
              messageId = res.messageId;
            }

            await db.from("outreach_warmup_sends").insert({
              id:              warmupId,
              from_inbox_id:   sender.id,
              to_inbox_id:     recipient.id,
              message_id:      messageId,
              thread_id:       threadId || messageId,
              subject:         template.subject,
              sent_at:         new Date().toISOString(),
            });
          } catch (err) {
            console.error(`Warmup send failed ${sender.email_address} → ${recipient.email_address}: ${String(err)}`);
          }
        }
      }
    });

    // ── Step B: Reply to received warmup emails (~40%) ────────────────────────
    await step.run("warmup-reply", async () => {
      const db = supabase();

      const { data: pool } = await db
        .from("outreach_inboxes")
        .select("*")
        .eq("status", "active")
        .eq("warmup_enabled", true);

      if (!pool || pool.length < 2) return;

      // Find warmup sends from last 24h that haven't been replied to yet
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const { data: pending } = await db
        .from("outreach_warmup_sends")
        .select("*")
        .gte("sent_at", since.toISOString())
        .is("replied_at", null);

      for (const warmupSend of pending ?? []) {
        if (Math.random() > 0.4) continue; // only ~40% reply rate

        const recipientInbox = pool.find((p) => p.id === warmupSend.to_inbox_id);
        const senderInbox    = pool.find((p) => p.id === warmupSend.from_inbox_id);
        if (!recipientInbox || !senderInbox) continue;

        const seed = `reply-${warmupSend.id}`;
        const replyTemplate = selectReplyTemplate(seed);
        const replyWarmupId = crypto.randomUUID();
        const warmupHeader  = { "X-PP-Ref": replyWarmupId };
        const replySubject  = warmupSend.subject ? `Re: ${warmupSend.subject}` : "Re: (no subject)";
        const htmlBody = `<!--pps-ref:${replyWarmupId}--><p>${replyTemplate.body}</p>`;

        try {
          if (recipientInbox.provider === "gmail" && recipientInbox.oauth_refresh_token) {
            await sendGmailMessage(recipientInbox as OutreachInbox, {
              to:                  senderInbox.email_address,
              subject:             replySubject,
              htmlBody,
              textBody:            replyTemplate.body,
              replyToThreadId:     warmupSend.thread_id ?? undefined,
              inReplyToMessageId:  warmupSend.message_id ?? undefined,
              customHeaders:       warmupHeader,
            });
          } else if (recipientInbox.provider === "outlook" && recipientInbox.oauth_refresh_token) {
            await sendMicrosoftMessage(recipientInbox as OutreachInbox, {
              to:                  senderInbox.email_address,
              subject:             replySubject,
              htmlBody,
              textBody:            replyTemplate.body,
              replyToThreadId:     warmupSend.thread_id ?? undefined,
              inReplyToMessageId:  warmupSend.message_id ?? undefined,
              customHeaders:       warmupHeader,
            });
          } else {
            await sendSmtpMessage(recipientInbox as OutreachInbox, {
              to:                  senderInbox.email_address,
              subject:             replySubject,
              htmlBody,
              textBody:            replyTemplate.body,
              inReplyToMessageId:  warmupSend.message_id ?? undefined,
              customHeaders:       warmupHeader,
            });
          }

          await db
            .from("outreach_warmup_sends")
            .update({ replied_at: new Date().toISOString() })
            .eq("id", warmupSend.id);
        } catch (err) {
          console.error(`Warmup reply failed: ${String(err)}`);
        }
      }
    });

    // ── Step C: Spam rescue ───────────────────────────────────────────────────
    await step.run("warmup-spam-rescue", async () => {
      const db = supabase();

      const { data: pool } = await db
        .from("outreach_inboxes")
        .select("*")
        .eq("status", "active")
        .eq("warmup_enabled", true);

      if (!pool?.length) return;

      // Find warmup sends from last 24h that need rescue check
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const { data: recentSends } = await db
        .from("outreach_warmup_sends")
        .select("*")
        .gte("sent_at", since.toISOString())
        .eq("rescued_from_spam", false);

      for (const warmupSend of recentSends ?? []) {
        const recipientInbox = pool.find((p) => p.id === warmupSend.to_inbox_id);
        if (!recipientInbox) continue;

        let rescued = false;

        try {
          if (recipientInbox.provider === "gmail" && recipientInbox.oauth_refresh_token) {
            rescued = await rescueGmailWarmup(recipientInbox as OutreachInbox, warmupSend.id);
          } else if (recipientInbox.provider === "outlook" && recipientInbox.oauth_refresh_token) {
            const { rescueMicrosoftWarmupFromSpam } = await import("@/lib/outreach/microsoft");
            rescued = await rescueMicrosoftWarmupFromSpam(recipientInbox as OutreachInbox, warmupSend.id);
          } else {
            rescued = await rescueSmtpWarmup(recipientInbox as OutreachInbox, warmupSend.id);
          }

          if (rescued) {
            await db
              .from("outreach_warmup_sends")
              .update({ rescued_from_spam: true })
              .eq("id", warmupSend.id);
          }
        } catch (err) {
          console.error(`Spam rescue failed for ${warmupSend.id}: ${String(err)}`);
        }
      }
    });
  },
);

// ─── Gmail spam rescue ────────────────────────────────────────────────────────

async function rescueGmailWarmup(inbox: OutreachInbox, warmupSendId: string): Promise<boolean> {
  const { getGmailClient } = await import("@/lib/outreach/gmail");
  const gmail = await getGmailClient(inbox);

  const spam = await gmail.users.messages.list({
    userId:    "me",
    labelIds:  ["SPAM"],
    q:         "newer_than:1d",
    maxResults: 50,
  });

  for (const item of spam.data.messages ?? []) {
    if (!item.id) continue;

    const msg = await gmail.users.messages.get({
      userId:          "me",
      id:              item.id,
      format:          "metadata",
      metadataHeaders: ["X-PP-Ref"],
    });

    const headers  = msg.data.payload?.headers ?? [];
    const warmupId = headers.find((h) => h.name === "X-PP-Ref")?.value;
    if (warmupId !== warmupSendId) continue;

    await gmail.users.messages.modify({
      userId: "me",
      id:     item.id,
      requestBody: {
        addLabelIds:    ["INBOX", "IMPORTANT"],
        removeLabelIds: ["SPAM"],
      },
    });
    return true;
  }
  return false;
}

// ─── SMTP/IMAP spam rescue ────────────────────────────────────────────────────

async function rescueSmtpWarmup(inbox: OutreachInbox, warmupSendId: string): Promise<boolean> {
  if (!inbox.imap_host) return false;

  try {
    const { ImapFlow } = await import("imapflow");
    const { decrypt }  = await import("@/lib/outreach/crypto");

    const pass = inbox.smtp_pass_encrypted ? decrypt(inbox.smtp_pass_encrypted) : "";
    const client = new ImapFlow({
      host:   inbox.imap_host,
      port:   inbox.imap_port ?? 993,
      secure: true,
      auth:   { user: inbox.smtp_user!, pass },
      logger: false,
    });

    await client.connect();

    // Try common spam folder names
    const spamFolders = ["Junk", "[Gmail]/Spam", "Spam", "Junk Email"];
    let rescued = false;

    for (const folder of spamFolders) {
      let lock;
      try {
        lock = await client.getMailboxLock(folder);
      } catch {
        continue; // folder doesn't exist
      }

      try {
        for await (const msg of client.fetch(
          { since: new Date(Date.now() - 24 * 60 * 60 * 1000) },
          { envelope: true, headers: ["x-pp-ref"] },
        )) {
          const headerStr = msg.headers?.toString() ?? "";
          const match = headerStr.match(/x-pp-ref:\s*(.+)/i);
          if (match?.[1]?.trim() !== warmupSendId) continue;

          if (msg.uid) {
            await client.messageMove(String(msg.uid), "INBOX", { uid: true });
            rescued = true;
          }
          break;
        }
      } finally {
        lock.release();
      }

      if (rescued) break;
    }

    await client.logout();
    return rescued;
  } catch (err) {
    console.error(`SMTP spam rescue failed: ${String(err)}`);
    return false;
  }
}
