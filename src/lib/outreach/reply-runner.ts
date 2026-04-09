/**
 * Reply ingest pipeline.
 *
 * For every connected inbox:
 *   1. Fetch ALL new messages (not just replies — catches other-address replies)
 *   2. De-duplicate via message_id
 *   3. Apply CRM filter rules (phrase / subject / sender)
 *   4. OOO regex shortcut (avoid Gemini call for obvious auto-replies)
 *   5. AI classify via Gemini
 *   6. Store in outreach_replies
 *   7. Match to outreach_sends / outreach_enrollments
 *   8. Auto-update crm_status when confident
 */

import { createClient } from "@supabase/supabase-js";
import { markEnrollmentReplied } from "@/lib/outreach/scheduler";
import type { OutreachCrmFilter } from "@/types/outreach";

function supabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

// ─── OOO / Auto-reply regex shortcuts ────────────────────────────────────────
const OOO_PATTERNS = [
  /out of (the )?office/i,
  /on vacation/i,
  /away from (the )?office/i,
  /automatic(ally)? reply/i,
  /auto.?reply/i,
  /i('m| am) currently (away|out|unavailable)/i,
  /will be (back|returning)/i,
  /on (annual|maternity|paternity|sick) leave/i,
  /currently (out|away|travelling)/i,
  /this is an automated/i,
  /do not reply to this (email|message)/i,
];

function detectOoo(subject?: string | null, body?: string | null): boolean {
  const text = `${subject ?? ""} ${body ?? ""}`;
  return OOO_PATTERNS.some((p) => p.test(text));
}

// ─── Filter rule application ──────────────────────────────────────────────────

function applyFilters(
  filters: OutreachCrmFilter[],
  msg: { fromEmail: string; subject: string | null; bodyText: string | null },
): { action: string; reason: string; auto_status?: string } | null {
  const body    = (msg.bodyText  ?? "").toLowerCase();
  const subject = (msg.subject   ?? "").toLowerCase();
  const from    = msg.fromEmail.toLowerCase();

  for (const f of filters) {
    const val = f.value.toLowerCase();
    let hit = false;

    switch (f.type) {
      case "phrase":         hit = body.includes(val) || subject.includes(val); break;
      case "subject_phrase": hit = subject.includes(val); break;
      case "sender_email":   hit = from === val; break;
      case "sender_domain":  hit = from.endsWith(`@${val.replace(/^@/, "")}`); break;
    }

    if (hit) {
      return { action: f.action, reason: f.name, auto_status: f.auto_status ?? undefined };
    }
  }
  return null;
}

// ─── AI classification ────────────────────────────────────────────────────────

const VALID_CATEGORIES = new Set(["interested", "meeting_booked", "not_interested", "ooo", "follow_up", "neutral"]);

async function aiClassify(
  subject: string | null,
  bodyText: string | null,
): Promise<{ category: string; confidence: number }> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return { category: "neutral", confidence: 0 };

  const snippet = (bodyText ?? "").slice(0, 500).replace(/\s+/g, " ");
  const prompt = `Classify this cold email reply into one category.
Categories: interested, meeting_booked, not_interested, ooo, follow_up, neutral
- interested: shows interest, asks for more info
- meeting_booked: confirms or accepts a meeting/call
- not_interested: declines, unsubscribes, says not relevant
- ooo: out of office, vacation, auto-reply
- follow_up: asks to contact later
- neutral: unclear

Subject: ${subject ?? "(none)"}
Body: ${snippet}

Respond with JSON only: {"category": "...", "confidence": 0.0-1.0}`;

  try {
    const { GoogleGenerativeAI } = await import("@google/generative-ai");
    const genai = new GoogleGenerativeAI(apiKey);
    const model = genai.getGenerativeModel({ model: "gemini-3-flash-preview" });
    const result = await model.generateContent(prompt);
    const text = result.response.text().trim().replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(text);
    const category = VALID_CATEGORIES.has(parsed.category) ? parsed.category : "neutral";
    const confidence = typeof parsed.confidence === "number" ? Math.min(1, Math.max(0, parsed.confidence)) : 0.5;
    return { category, confidence };
  } catch {
    return { category: "neutral", confidence: 0 };
  }
}

// ─── Strip quoted reply content ───────────────────────────────────────────────
// Removes everything after "On ... wrote:" style dividers
function stripQuotedReply(text: string): string {
  return text
    .split(/\n[-_]{3,}\n|\nOn .+wrote:\n|^>.*$/m)[0]
    .trim();
}

// ─── IMAP full inbox fetch ────────────────────────────────────────────────────

interface RawMessage {
  messageId:  string;
  inReplyTo:  string | null;
  fromEmail:  string;
  fromName:   string | null;
  subject:    string | null;
  bodyText:   string | null;
  receivedAt: string;
  warmupId:   string | null;
}

/** Derive IMAP host from SMTP host when imap_host is blank. */
function deriveImapHost(smtpHost?: string | null): string | null {
  if (!smtpHost) return null;
  const h = smtpHost.toLowerCase();
  if (h.includes("outlook") || h.includes("office365")) return "outlook.office365.com";
  if (h.includes("gmail") || h.includes("googlemail"))  return "imap.gmail.com";
  // Generic: replace leading "smtp." with "imap."
  return h.replace(/^smtp\./, "imap.");
}

async function fetchImapMessages(
  inbox: { id: string; imap_host?: string | null; imap_port?: number | null; smtp_host?: string | null; smtp_user?: string | null; smtp_pass_encrypted?: string | null; email_address: string },
  lookbackDays = 7,
): Promise<{ messages: RawMessage[]; error?: string }> {
  const imapHost = inbox.imap_host || deriveImapHost(inbox.smtp_host);
  if (!imapHost) return { messages: [], error: "no imap_host configured" };

  const { ImapFlow } = await import("imapflow");
  const { decrypt } = await import("@/lib/outreach/crypto");

  const pass = inbox.smtp_pass_encrypted ? decrypt(inbox.smtp_pass_encrypted) : "";
  const port = inbox.imap_port ?? 993;
  const client = new ImapFlow({
    host:   imapHost,
    port,
    secure: port === 993 || port === 465,
    auth:   { user: inbox.smtp_user!, pass },
    logger: false,
    connectionTimeout: 8_000,
    greetingTimeout:   5_000,
    socketTimeout:     10_000,
  });

  try {
    await client.connect();
  } catch (e) {
    return { messages: [], error: `IMAP connect failed: ${String(e).slice(0, 200)}` };
  }

  let lock;
  try {
    lock = await client.getMailboxLock("INBOX");
  } catch (e) {
    await client.logout().catch(() => {});
    return { messages: [], error: `INBOX lock failed: ${String(e).slice(0, 200)}` };
  }

  const messages: RawMessage[] = [];

  try {
    // Look back far enough to catch historical replies.
    // De-duplication by message_id prevents re-processing.
    const since = new Date(Date.now() - lookbackDays * 24 * 60 * 60 * 1000);

    for await (const msg of client.fetch(
      { since },
      {
        envelope: true,
        source:   true,   // full raw message — most reliable across all servers
        headers:  ["in-reply-to", "references", "x-pps-warmup", "message-id"],
      },
    )) {
      const headerStr  = msg.headers ? msg.headers.toString() : "";
      const inReplyToM = headerStr.match(/in-reply-to:\s*(.+)/im);
      const warmupM    = headerStr.match(/x-pps-warmup:\s*(.+)/im);

      const fromAddr = msg.envelope?.from?.[0]?.address ?? "";
      const fromName = msg.envelope?.from?.[0]?.name ?? null;

      // Skip emails sent FROM this inbox (prevents self-loops)
      if (fromAddr.toLowerCase() === inbox.email_address.toLowerCase()) continue;

      // Extract plain-text body from raw source
      let bodyText: string | null = null;
      if (msg.source) {
        const raw = msg.source.toString();
        bodyText = extractPlainText(raw);
      }

      messages.push({
        messageId:  (msg.envelope?.messageId ?? "").replace(/^<|>$/g, ""),
        inReplyTo:  inReplyToM?.[1]?.trim().replace(/^<|>$/g, "") ?? null,
        fromEmail:  fromAddr,
        fromName:   fromName || null,
        subject:    msg.envelope?.subject ?? null,
        bodyText:   bodyText ? stripQuotedReply(bodyText) : null,
        receivedAt: (msg.envelope?.date ?? new Date()).toISOString(),
        warmupId:   warmupM?.[1]?.trim() ?? null,
      });
    }
  } finally {
    lock.release();
    await client.logout().catch(() => {});
  }

  return { messages };
}

/**
 * Extract plain-text content from a raw MIME email source.
 * Tries text/plain first, falls back to stripping HTML tags.
 */
function extractPlainText(rawSource: string): string | null {
  // Find text/plain part
  const plainMatch = rawSource.match(/content-type:\s*text\/plain[^\n]*\n(?:.*\n)*?\n([\s\S]*?)(?=\n--|\n\r?\nContent-Type:|$)/i);
  if (plainMatch?.[1]?.trim()) {
    return decodeQuotedPrintable(plainMatch[1]).trim();
  }

  // Fallback: strip HTML tags from text/html part
  const htmlMatch = rawSource.match(/content-type:\s*text\/html[^\n]*\n(?:.*\n)*?\n([\s\S]*?)(?=\n--|\n\r?\nContent-Type:|$)/i);
  if (htmlMatch?.[1]) {
    return htmlMatch[1]
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/\s+/g, " ")
      .trim() || null;
  }

  return null;
}

function decodeQuotedPrintable(str: string): string {
  return str
    .replace(/=\r?\n/g, "")
    .replace(/=([0-9A-F]{2})/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
}

// ─── Core ingest loop ─────────────────────────────────────────────────────────

async function ingestMessages(
  db: ReturnType<typeof supabase>,
  inboxId: string,
  messages: RawMessage[],
  filters: OutreachCrmFilter[],
): Promise<{ matched: number; unmatched: number; filtered: number }> {
  let matched = 0, unmatched = 0, filtered = 0;

  // Load existing message_ids in batch to avoid per-message queries
  const msgIds = messages.map((m) => m.messageId).filter(Boolean);
  const { data: existing } = msgIds.length
    ? await db.from("outreach_replies").select("message_id").in("message_id", msgIds)
    : { data: [] };
  const seenIds = new Set((existing ?? []).map((r) => r.message_id));

  for (const msg of messages) {
    // De-duplicate
    if (msg.messageId && seenIds.has(msg.messageId)) continue;

    // Warmup reply — update warmup table, never touch CRM
    if (msg.warmupId) {
      await db.from("outreach_warmup_sends")
        .update({ replied_at: new Date().toISOString() })
        .eq("id", msg.warmupId)
        .is("replied_at", null);
      continue;
    }

    // Also skip if thread matches a warmup send (lost header fallback)
    if (msg.messageId) {
      const { data: warmupByThread } = await db
        .from("outreach_warmup_sends").select("id")
        .eq("thread_id", msg.messageId).limit(1).single();
      if (warmupByThread) continue;
    }

    // Apply CRM filter rules
    const filterHit = applyFilters(filters, {
      fromEmail: msg.fromEmail,
      subject:   msg.subject,
      bodyText:  msg.bodyText,
    });

    if (filterHit?.action === "exclude") {
      await db.from("outreach_replies").insert({
        inbox_id:      inboxId,
        from_email:    msg.fromEmail,
        from_name:     msg.fromName,
        subject:       msg.subject,
        body_text:     msg.bodyText,
        message_id:    msg.messageId || null,
        in_reply_to:   msg.inReplyTo,
        received_at:   msg.receivedAt,
        is_filtered:   true,
        filter_reason: filterHit.reason,
      });
      filtered++;
      continue;
    }

    // ── Match to outreach_sends ───────────────────────────────────────────────
    let send: { id: string; enrollment_id: string } | null = null;

    if (msg.inReplyTo) {
      const { data } = await db.from("outreach_sends").select("id, enrollment_id")
        .eq("message_id", msg.inReplyTo).is("replied_at", null).limit(1).single();
      send = data ?? null;
    }
    if (!send && msg.messageId) {
      const { data } = await db.from("outreach_sends").select("id, enrollment_id")
        .eq("thread_id", msg.messageId).is("replied_at", null).limit(1).single();
      send = data ?? null;
    }
    if (!send && msg.fromEmail) {
      const { data } = await db.from("outreach_sends").select("id, enrollment_id")
        .eq("to_email", msg.fromEmail.toLowerCase()).eq("status", "sent").is("replied_at", null)
        .order("sent_at", { ascending: false }).limit(1).single();
      send = data ?? null;
    }

    // ── AI classification ─────────────────────────────────────────────────────
    let aiCategory = "neutral";
    let aiConfidence = 0;

    // Check filter auto_status first
    if (filterHit?.action === "auto_status" && filterHit.auto_status) {
      aiCategory   = filterHit.auto_status;
      aiConfidence = 1.0;
    } else if (detectOoo(msg.subject, msg.bodyText)) {
      aiCategory   = "ooo";
      aiConfidence = 1.0;
    } else {
      const result = await aiClassify(msg.subject, msg.bodyText);
      aiCategory   = result.category;
      aiConfidence = result.confidence;
    }

    // ── Store reply ───────────────────────────────────────────────────────────
    await db.from("outreach_replies").insert({
      inbox_id:      inboxId,
      send_id:       send?.id ?? null,
      enrollment_id: send?.enrollment_id ?? null,
      from_email:    msg.fromEmail,
      from_name:     msg.fromName,
      subject:       msg.subject,
      body_text:     msg.bodyText,
      message_id:    msg.messageId || null,
      in_reply_to:   msg.inReplyTo,
      received_at:   msg.receivedAt,
      ai_category:   aiCategory,
      ai_confidence: aiConfidence,
      is_filtered:   false,
    });

    if (send) {
      await markEnrollmentReplied(send.enrollment_id, send.id);

      // Auto-update crm_status if confident and currently neutral
      if (aiConfidence >= 0.7 && aiCategory !== "neutral") {
        const { data: enrollment } = await db.from("outreach_enrollments")
          .select("crm_status").eq("id", send.enrollment_id).single();
        if (enrollment?.crm_status === "neutral") {
          await db.from("outreach_enrollments")
            .update({ crm_status: aiCategory })
            .eq("id", send.enrollment_id);
        }
      }
      matched++;
    } else {
      unmatched++;
    }
  }

  return { matched, unmatched, filtered };
}

// ─── Public entry point ───────────────────────────────────────────────────────

export interface ReplyPollResult {
  inboxes:   number;
  matched:   number;
  unmatched: number;
  filtered:  number;
  details:   Array<{ email: string; fetched: number; matched: number; unmatched: number; error?: string }>;
}

export async function runReplyPoll(lookbackDays = 7): Promise<ReplyPollResult> {
  const db = supabase();

  const [{ data: inboxes }, { data: filtersData }] = await Promise.all([
    db.from("outreach_inboxes").select("*").eq("status", "active"),
    db.from("outreach_crm_filters").select("*").order("created_at"),
  ]);

  if (!inboxes?.length) return { inboxes: 0, matched: 0, unmatched: 0, filtered: 0, details: [] };

  const filters = (filtersData ?? []) as OutreachCrmFilter[];

  // Process inboxes in parallel batches (5 at a time) to avoid sequential timeouts
  const CONCURRENCY = 5;
  const allDetails: ReplyPollResult["details"] = [];
  let totalMatched = 0, totalUnmatched = 0, totalFiltered = 0;

  type InboxRow = NonNullable<typeof inboxes>[number];
  async function processInbox(inbox: InboxRow): Promise<ReplyPollResult["details"][0]> {
    let messages: RawMessage[] = [];
    let fetchError: string | undefined;

    // ── IMAP — use imap_host if set, or derive it from smtp_host ─────────────
    if (inbox.imap_host || deriveImapHost(inbox.smtp_host)) {
      const result = await fetchImapMessages(inbox, lookbackDays);
      messages   = result.messages;
      fetchError = result.error;
      if (fetchError) {
        await db.from("outreach_inboxes")
          .update({ last_error: `IMAP poll: ${fetchError}` })
          .eq("id", inbox.id);
      }
    }
    // ── Gmail OAuth history-based fallback ────────────────────────────────────
    else if (inbox.provider === "gmail" && inbox.oauth_refresh_token && inbox.gmail_history_id) {
      try {
        const { fetchNewMessages } = await import("@/lib/outreach/gmail");
        const raw = await fetchNewMessages(inbox, inbox.gmail_history_id).catch(() => []);
        messages = raw.map((r) => ({
          messageId:  (r.messageId ?? "").replace(/^<|>$/g, ""),
          inReplyTo:  null,
          fromEmail:  r.fromEmail ?? "",
          fromName:   null,
          subject:    null,
          bodyText:   null,
          receivedAt: new Date().toISOString(),
          warmupId:   null,
        }));
      } catch (e) { fetchError = String(e); }
    }
    // ── Outlook OAuth fallback ────────────────────────────────────────────────
    else if (inbox.provider === "outlook" && inbox.oauth_refresh_token && !inbox.ms_subscription_id) {
      try {
        const { fetchNewReplies } = await import("@/lib/outreach/microsoft");
        const since = new Date(Date.now() - lookbackDays * 24 * 60 * 60 * 1000);
        const raw = await fetchNewReplies(inbox, since).catch(() => []);
        messages = raw.map((r) => ({
          messageId:  (r.threadId ?? "").replace(/^<|>$/g, ""),
          inReplyTo:  null,
          fromEmail:  r.fromEmail ?? "",
          fromName:   null,
          subject:    null,
          bodyText:   null,
          receivedAt: r.receivedAt ?? new Date().toISOString(),
          warmupId:   null,
        }));
      } catch (e) { fetchError = String(e); }
    } else {
      fetchError = "no imap_host and no OAuth credentials";
    }

    let inboxMatched = 0, inboxUnmatched = 0;
    if (messages.length) {
      const result = await ingestMessages(db, inbox.id, messages, filters);
      inboxMatched   = result.matched;
      inboxUnmatched = result.unmatched;
      totalMatched   += result.matched;
      totalUnmatched += result.unmatched;
      totalFiltered  += result.filtered;
    }

    return {
      email:     inbox.email_address,
      fetched:   messages.length,
      matched:   inboxMatched,
      unmatched: inboxUnmatched,
      ...(fetchError ? { error: fetchError } : {}),
    };
  }

  // Run in batches of CONCURRENCY
  for (let i = 0; i < inboxes.length; i += CONCURRENCY) {
    const batch = inboxes.slice(i, i + CONCURRENCY);
    const results = await Promise.all(batch.map(processInbox));
    allDetails.push(...results);
  }

  return { inboxes: inboxes.length, matched: totalMatched, unmatched: totalUnmatched, filtered: totalFiltered, details: allDetails };
}
