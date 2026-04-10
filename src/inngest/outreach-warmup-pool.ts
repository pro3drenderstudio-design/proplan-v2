import { createClient } from "@supabase/supabase-js";
import { inngest } from "@/lib/inngest";
import { runWarmupBatch } from "@/lib/outreach/warmup-runner";
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
    triggers: [
      { cron: "0 */4 * * *" },
      { event: "outreach/warmup-pool.trigger" },
    ],
  },
  async ({ step }) => {
    await step.run("warmup-send-and-reply", () => runWarmupBatch());

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
