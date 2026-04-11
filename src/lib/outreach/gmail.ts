import { google } from "googleapis";
import { createClient } from "@supabase/supabase-js";
import { decrypt, encrypt } from "./crypto";
import type { OutreachInbox } from "@/types/outreach";

const CLIENT_ID     = process.env.GOOGLE_CLIENT_ID!;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET!;
const REDIRECT_URI  = process.env.GOOGLE_REDIRECT_URI!;
const PUBSUB_TOPIC  = process.env.GOOGLE_PUBSUB_TOPIC!;

function supabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

// ─── OAuth2 client ────────────────────────────────────────────────────────────

export function createOAuth2Client() {
  return new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);
}

export function getAuthorizationUrl(state: string): string {
  const oauth2 = createOAuth2Client();
  return oauth2.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: [
      "https://www.googleapis.com/auth/gmail.send",
      "https://www.googleapis.com/auth/gmail.readonly",
      "https://www.googleapis.com/auth/gmail.modify",
      "https://www.googleapis.com/auth/userinfo.email",
    ],
    state,
  });
}

// ─── getGmailClient ───────────────────────────────────────────────────────────

/**
 * Returns an authenticated Gmail API client.
 * Auto-refreshes the access token if expired and persists the new token.
 */
export async function getGmailClient(inbox: OutreachInbox) {
  const oauth2 = createOAuth2Client();

  const accessToken  = inbox.oauth_access_token  ? decrypt(inbox.oauth_access_token)  : null;
  const refreshToken = inbox.oauth_refresh_token ? decrypt(inbox.oauth_refresh_token) : null;

  oauth2.setCredentials({
    access_token:  accessToken,
    refresh_token: refreshToken,
    expiry_date:   inbox.oauth_expires_at ? new Date(inbox.oauth_expires_at).getTime() : undefined,
  });

  // Refresh listener — persist new tokens back to Supabase
  oauth2.on("tokens", async (tokens) => {
    const updates: Record<string, string | null> = {};
    if (tokens.access_token) {
      updates.oauth_access_token = encrypt(tokens.access_token);
      updates.oauth_expires_at   = tokens.expiry_date ? new Date(tokens.expiry_date).toISOString() : null;
    }
    if (tokens.refresh_token) {
      updates.oauth_refresh_token = encrypt(tokens.refresh_token);
    }
    if (Object.keys(updates).length > 0) {
      await supabase().from("outreach_inboxes").update(updates).eq("id", inbox.id);
    }
  });

  return google.gmail({ version: "v1", auth: oauth2 });
}

// ─── sendGmailMessage ─────────────────────────────────────────────────────────

export interface GmailSendOptions {
  to: string;
  subject: string;
  htmlBody: string;
  textBody: string;
  fromName?: string;
  replyToThreadId?: string;
  inReplyToMessageId?: string;
  customHeaders?: Record<string, string>;
}

export interface GmailSendResult {
  messageId:    string; // Gmail internal ID
  threadId:     string; // Gmail internal thread ID
  rfcMessageId: string; // RFC 2822 Message-ID header — use this for In-Reply-To / References
}

export async function sendGmailMessage(
  inbox: OutreachInbox,
  opts: GmailSendOptions,
): Promise<GmailSendResult> {
  const gmail = await getGmailClient(inbox);

  const from = opts.fromName
    ? `${opts.fromName} <${inbox.email_address}>`
    : inbox.email_address;

  const boundary = `boundary_${Date.now().toString(36)}`;
  // Normalise the inReplyToMessageId — it must be an RFC 2822 Message-ID
  // (e.g. <CABcde@mail.gmail.com>). Ensure it is wrapped in angle brackets.
  const normaliseId = (id: string) => (id.startsWith("<") ? id : `<${id}>`);

  const rawMessage = [
    `From: ${from}`,
    `To: ${opts.to}`,
    `Subject: ${opts.subject}`,
    `MIME-Version: 1.0`,
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    opts.inReplyToMessageId ? `In-Reply-To: ${normaliseId(opts.inReplyToMessageId)}` : "",
    opts.inReplyToMessageId ? `References: ${normaliseId(opts.inReplyToMessageId)}` : "",
    ...(opts.customHeaders ? Object.entries(opts.customHeaders).map(([k, v]) => `${k}: ${v}`) : []),
    ``,
    `--${boundary}`,
    `Content-Type: text/plain; charset=UTF-8`,
    ``,
    opts.textBody,
    ``,
    `--${boundary}`,
    `Content-Type: text/html; charset=UTF-8`,
    ``,
    opts.htmlBody,
    ``,
    `--${boundary}--`,
  ]
    .filter((line) => line !== undefined)
    .join("\r\n");

  const encoded = Buffer.from(rawMessage)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  // Do NOT pass threadId in requestBody for cross-inbox replies — thread IDs
  // are scoped to the owning account; a foreign thread ID causes a 400.
  // Threading is handled entirely via In-Reply-To / References headers.
  const res = await gmail.users.messages.send({
    userId: "me",
    requestBody: { raw: encoded },
  });

  const gmailId = res.data.id ?? "";
  const threadId = res.data.threadId ?? "";

  // Fetch the RFC 2822 Message-ID header from the just-sent message.
  // This is what mail clients use for threading — it differs from Gmail's
  // internal numeric ID stored in res.data.id.
  let rfcMessageId = gmailId;
  try {
    const detail = await gmail.users.messages.get({
      userId: "me",
      id:     gmailId,
      format: "metadata",
      metadataHeaders: ["Message-ID"],
    });
    const mid = detail.data.payload?.headers
      ?.find((h) => h.name?.toLowerCase() === "message-id")?.value;
    if (mid) rfcMessageId = mid;
  } catch {
    // Non-fatal — fall back to Gmail internal ID
  }

  return { messageId: gmailId, threadId, rfcMessageId };
}

// ─── rescueFromSpam ───────────────────────────────────────────────────────────

/**
 * Searches the recipient's inbox for a recently received warmup email and:
 *   1. Moves it out of Spam / Promotions into the inbox
 *   2. Marks it Important so Gmail's engagement signals treat it favourably
 *
 * Called after a warmup send so the recipient account builds positive signals.
 */
export async function rescueFromSpam(
  recipientInbox: OutreachInbox,
  fromEmail: string,
  subject: string,
): Promise<void> {
  if (!recipientInbox.oauth_refresh_token) return;
  const gmail = await getGmailClient(recipientInbox);

  // Search the last hour of mail from the sender with a matching subject
  const q = `from:${fromEmail} subject:"${subject.replace(/"/g, "")}" newer_than:1h`;
  const list = await gmail.users.messages.list({ userId: "me", q, maxResults: 5 });

  for (const msg of list.data.messages ?? []) {
    if (!msg.id) continue;
    await gmail.users.messages.modify({
      userId: "me",
      id:     msg.id,
      requestBody: {
        addLabelIds:    ["INBOX", "IMPORTANT"],
        removeLabelIds: ["SPAM", "CATEGORY_PROMOTIONS", "CATEGORY_UPDATES"],
      },
    }).catch(() => {/* non-fatal */});
  }
}

// ─── watchGmailInbox (Pub/Sub push notifications) ────────────────────────────

export async function watchGmailInbox(inbox: OutreachInbox): Promise<void> {
  if (!PUBSUB_TOPIC) return;
  const gmail = await getGmailClient(inbox);

  const res = await gmail.users.watch({
    userId: "me",
    requestBody: {
      topicName: PUBSUB_TOPIC,
      labelIds: ["INBOX"],
    },
  });

  const expiry = res.data.expiration
    ? new Date(parseInt(res.data.expiration, 10)).toISOString()
    : null;

  await supabase()
    .from("outreach_inboxes")
    .update({
      gmail_history_id:   res.data.historyId ?? null,
      gmail_watch_expiry: expiry,
    })
    .eq("id", inbox.id);
}

// ─── fetchRecentMessages (messages.list fallback — no history ID needed) ──────

export async function fetchRecentMessages(
  inbox: OutreachInbox,
  lookbackDays = 7,
): Promise<GmailIncomingMessage[]> {
  const gmail = await getGmailClient(inbox);
  const messages: GmailIncomingMessage[] = [];

  // List inbox messages received in the last N days
  const listRes = await gmail.users.messages.list({
    userId:     "me",
    q:          `in:inbox newer_than:${lookbackDays}d`,
    maxResults: 100,
  });

  // Also store a history ID now so future polls use the faster history API
  const profileRes = await gmail.users.getProfile({ userId: "me" }).catch(() => null);
  if (profileRes?.data.historyId) {
    await supabase()
      .from("outreach_inboxes")
      .update({ gmail_history_id: profileRes.data.historyId })
      .eq("id", inbox.id);
  }

  for (const item of listRes.data.messages ?? []) {
    if (!item.id) continue;
    const msg = await gmail.users.messages.get({
      userId:          "me",
      id:              item.id,
      format:          "full",
      metadataHeaders: ["From", "Subject", "In-Reply-To", "References", "X-PP-Ref"],
    });

    const headers  = msg.data.payload?.headers ?? [];
    const getH     = (n: string) => headers.find((h) => h.name?.toLowerCase() === n.toLowerCase())?.value ?? null;
    const fromRaw  = getH("From") ?? "";
    const fromEmail = fromRaw.match(/<([^>]+)>/)?.[1] ?? fromRaw;
    const inReplyTo = getH("In-Reply-To");
    const warmupId  = getH("X-PP-Ref");

    // Extract plain-text body
    let bodyText: string | null = null;
    const extractBody = (part: typeof msg.data.payload): string | null => {
      if (!part) return null;
      if (part.mimeType === "text/plain" && part.body?.data) {
        return Buffer.from(part.body.data, "base64").toString("utf-8");
      }
      for (const sub of part.parts ?? []) {
        const found = extractBody(sub);
        if (found) return found;
      }
      return null;
    };
    bodyText = extractBody(msg.data.payload ?? undefined);

    messages.push({
      messageId:  item.id,
      threadId:   msg.data.threadId ?? "",
      inReplyTo,
      fromEmail,
      warmupId,
      subject:    getH("Subject"),
      bodyText,
    });
  }

  return messages;
}

// ─── fetchNewMessages (reply detection via history API) ───────────────────────

export interface GmailIncomingMessage {
  messageId:  string;
  threadId:   string;
  inReplyTo:  string | null;
  fromEmail:  string;
  warmupId:   string | null;
  subject?:   string | null;
  bodyText?:  string | null;
}

export async function fetchNewMessages(
  inbox: OutreachInbox,
  sinceHistoryId: string,
): Promise<GmailIncomingMessage[]> {
  const gmail = await getGmailClient(inbox);

  const historyRes = await gmail.users.history.list({
    userId:          "me",
    startHistoryId:  sinceHistoryId,
    historyTypes:    ["messageAdded"],
    labelId:         "INBOX",
  });

  const newHistoryId = historyRes.data.historyId;
  if (newHistoryId) {
    await supabase()
      .from("outreach_inboxes")
      .update({ gmail_history_id: newHistoryId })
      .eq("id", inbox.id);
  }

  const messages: GmailIncomingMessage[] = [];
  const history = historyRes.data.history ?? [];

  for (const record of history) {
    for (const added of record.messagesAdded ?? []) {
      const msgId = added.message?.id;
      if (!msgId) continue;

      const msg = await gmail.users.messages.get({
        userId: "me",
        id:     msgId,
        format: "metadata",
        metadataHeaders: ["From", "In-Reply-To", "References", "X-PP-Ref"],
      });

      const headers = msg.data.payload?.headers ?? [];
      const getHeader = (name: string) =>
        headers.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value ?? null;

      const inReplyTo = getHeader("In-Reply-To");
      const warmupId  = getHeader("X-PP-Ref");
      const fromRaw   = getHeader("From") ?? "";
      const fromEmail = fromRaw.match(/<([^>]+)>/)?.[1] ?? fromRaw;

      if (!inReplyTo && !warmupId) continue; // Neither reply nor warmup

      messages.push({
        messageId:  msgId,
        threadId:   msg.data.threadId ?? "",
        inReplyTo,
        fromEmail,
        warmupId,
      });
    }
  }

  return messages;
}
