import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import Papa from "papaparse";
import nodemailer from "nodemailer";
import { encrypt } from "@/lib/outreach/crypto";
import type { InboxImportResult } from "@/types/outreach";

function supabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

const SAFE_COLUMNS =
  "id,label,provider,email_address,daily_send_limit,send_window_start,send_window_end,timezone,status,warmup_enabled,warmup_current_daily,warmup_target_daily,created_at,updated_at";

type CsvRow = Record<string, string | undefined>;

function detectProvider(smtpHost: string): "gmail" | "outlook" | "smtp" {
  const h = smtpHost.toLowerCase();
  if (h.includes("gmail")) return "gmail";
  if (h.includes("outlook") || h.includes("office365") || h.includes("hotmail") || h.includes("live.com")) return "outlook";
  return "smtp";
}

async function verifySmtpPlaintext(opts: {
  host: string; port: number; user: string; pass: string;
}): Promise<string | null> {
  try {
    const transport = nodemailer.createTransport({
      host: opts.host,
      port: opts.port,
      secure: opts.port === 465,
      auth: { user: opts.user, pass: opts.pass },
      tls: { rejectUnauthorized: false },
      connectionTimeout: 8000,
      greetingTimeout: 8000,
    });
    await transport.verify();
    transport.close();
    return null; // success
  } catch (err) {
    return String(err instanceof Error ? err.message : err).slice(0, 200);
  }
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });

    const text = await file.text();
    const { data: rows } = Papa.parse<CsvRow>(text, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h) => h.trim().toLowerCase().replace(/\s+/g, "_"),
    });

    if (!rows.length) {
      return NextResponse.json<InboxImportResult>({ imported: 0, skipped_duplicate: 0, failed_verification: 0, errors: [] });
    }

    const result: InboxImportResult = { imported: 0, skipped_duplicate: 0, failed_verification: 0, errors: [] };
    const seenEmails = new Set<string>();

    // ── Step 1: Parse and validate rows ──────────────────────────────────────
    type ParsedRow = {
      rowIndex: number;
      email: string;
      smtpHost: string;
      smtpPort: number;
      smtpUser: string;
      smtpPass: string;
      imapHost: string;
      imapPort: number;
      label: string;
      dailyLimit: number;
      timezone: string;
      sendWindowStart: string;
      sendWindowEnd: string;
      warmupTarget: number;
      signature: string | null;
    };

    const valid: ParsedRow[] = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 2; // 1-indexed + header row

      const email    = (row.email ?? row.email_address ?? "").trim().toLowerCase();
      const smtpHost = (row.smtp_host ?? "").trim();
      const smtpUser = (row.smtp_user ?? "").trim();
      const smtpPass = (row.smtp_pass ?? row.smtp_password ?? row.password ?? "").trim();

      if (!email) {
        result.errors.push({ row: rowNum, email: "(no email)", message: "email is required" });
        continue;
      }
      if (!smtpHost) {
        result.errors.push({ row: rowNum, email, message: "smtp_host is required" });
        continue;
      }
      if (!smtpUser) {
        result.errors.push({ row: rowNum, email, message: "smtp_user is required" });
        continue;
      }
      if (!smtpPass) {
        result.errors.push({ row: rowNum, email, message: "smtp_pass is required" });
        continue;
      }

      if (seenEmails.has(email)) {
        result.skipped_duplicate++;
        continue;
      }
      seenEmails.add(email);

      valid.push({
        rowIndex:        rowNum,
        email,
        smtpHost,
        smtpPort:        parseInt(row.smtp_port ?? "587") || 587,
        smtpUser,
        smtpPass,
        imapHost:        (row.imap_host ?? smtpHost).trim(),
        imapPort:        parseInt(row.imap_port ?? "993") || 993,
        label:           (row.label ?? email).trim(),
        dailyLimit:      parseInt(row.daily_limit ?? row.daily_send_limit ?? "50") || 50,
        timezone:        (row.timezone ?? "America/New_York").trim(),
        sendWindowStart: (row.send_window_start ?? "09:00").trim(),
        sendWindowEnd:   (row.send_window_end   ?? "17:00").trim(),
        warmupTarget:    parseInt(row.warmup_target ?? "50") || 50,
        signature:       row.signature?.trim() || null,
      });
    }

    // ── Step 2: Verify SMTP in parallel batches of 10 ────────────────────────
    const CONCURRENCY = 10;
    const verified: typeof valid = [];

    for (let i = 0; i < valid.length; i += CONCURRENCY) {
      const batch = valid.slice(i, i + CONCURRENCY);
      const results = await Promise.all(
        batch.map((r) =>
          verifySmtpPlaintext({ host: r.smtpHost, port: r.smtpPort, user: r.smtpUser, pass: r.smtpPass })
            .then((err) => ({ r, err }))
        )
      );
      for (const { r, err } of results) {
        if (err) {
          result.errors.push({ row: r.rowIndex, email: r.email, message: `SMTP verification failed: ${err}` });
          result.failed_verification++;
        } else {
          verified.push(r);
        }
      }
    }

    if (!verified.length) return NextResponse.json(result);

    // ── Step 3: Upsert verified rows in chunks of 50 ─────────────────────────
    const db = supabase();
    const CHUNK = 50;

    for (let i = 0; i < verified.length; i += CHUNK) {
      const chunk = verified.slice(i, i + CHUNK).map((r) => ({
        label:               r.label,
        provider:            detectProvider(r.smtpHost),
        email_address:       r.email,
        smtp_host:           r.smtpHost,
        smtp_port:           r.smtpPort,
        smtp_user:           r.smtpUser,
        smtp_pass_encrypted: encrypt(r.smtpPass),
        imap_host:           r.imapHost,
        imap_port:           r.imapPort,
        daily_send_limit:    r.dailyLimit,
        send_window_start:   r.sendWindowStart,
        send_window_end:     r.sendWindowEnd,
        timezone:            r.timezone,
        signature:           r.signature,
        status:              "active",
        warmup_enabled:      false,
        warmup_current_daily: 0,
        warmup_target_daily:  r.warmupTarget,
        warmup_ramp_per_week: 5,
      }));

      const { data, error } = await db
        .from("outreach_inboxes")
        .upsert(chunk, { onConflict: "email_address" })
        .select(SAFE_COLUMNS);

      if (error) {
        result.errors.push({ row: -1, email: "(batch)", message: error.message });
      } else {
        result.imported += data?.length ?? 0;
      }
    }

    return NextResponse.json(result);
  } catch (err) {
    console.error("Inbox import error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
