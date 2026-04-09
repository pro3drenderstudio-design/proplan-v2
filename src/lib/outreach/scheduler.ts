import { createClient } from "@supabase/supabase-js";
import type { OutreachEnrollment, OutreachCampaign, OutreachSequenceStep } from "@/types/outreach";

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

const DAY_NAMES = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

// ─── getDueEnrollments ────────────────────────────────────────────────────────

export interface DueEnrollment {
  enrollment: OutreachEnrollment;
  campaign: OutreachCampaign;
  step: OutreachSequenceStep;
}

/**
 * Fetches active enrollments whose next_send_at is in the past (or null = immediately due).
 * Returns at most `limit` results, joined with campaign + current sequence step.
 */
export async function getDueEnrollments(limit = 500): Promise<DueEnrollment[]> {
  const supabase = adminClient();
  const now = new Date().toISOString();

  const { data: enrollments, error } = await supabase
    .from("outreach_enrollments")
    .select(`
      *,
      campaign:outreach_campaigns(*),
      lead:outreach_leads(*)
    `)
    .eq("status", "active")
    .or(`next_send_at.is.null,next_send_at.lte.${now}`)
    .limit(limit);

  if (error || !enrollments) return [];

  const results: DueEnrollment[] = [];

  for (const enrollment of enrollments) {
    const campaign = enrollment.campaign as OutreachCampaign;
    if (!campaign || campaign.status !== "active") continue;

    // Fetch the sequence step at current_step index
    const { data: step } = await supabase
      .from("outreach_sequences")
      .select("*")
      .eq("campaign_id", campaign.id)
      .eq("step_order", enrollment.current_step)
      .single();

    if (!step) continue;

    // Check if current time is within the campaign's send window
    if (!isWithinSendWindow(campaign)) continue;

    results.push({ enrollment, campaign, step });
  }

  return results;
}

// ─── isWithinSendWindow ───────────────────────────────────────────────────────

function isWithinSendWindow(campaign: OutreachCampaign): boolean {
  const now = new Date();
  const tz = campaign.timezone ?? "America/New_York";

  // Get current time in campaign timezone
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  const parts = formatter.formatToParts(now);
  const weekday = parts.find((p) => p.type === "weekday")?.value?.toLowerCase().slice(0, 3) ?? "";
  const hour = parseInt(parts.find((p) => p.type === "hour")?.value ?? "0", 10);
  const minute = parseInt(parts.find((p) => p.type === "minute")?.value ?? "0", 10);
  const currentMinutes = hour * 60 + minute;

  const sendDays = campaign.send_days ?? ["mon", "tue", "wed", "thu", "fri"];
  if (!sendDays.includes(weekday)) return false;

  const [startH, startM] = (campaign.send_start_time ?? "09:00").split(":").map(Number);
  const [endH, endM] = (campaign.send_end_time ?? "17:00").split(":").map(Number);
  const windowStart = startH * 60 + startM;
  const windowEnd = endH * 60 + endM;

  return currentMinutes >= windowStart && currentMinutes < windowEnd;
}

// ─── computeNextSendAt ────────────────────────────────────────────────────────

/**
 * Given the current time and a wait_days value, computes the next valid send timestamp
 * that falls within the campaign's send window on an allowed day.
 */
export function computeNextSendAt(waitDays: number, campaign: OutreachCampaign): Date {
  const tz = campaign.timezone ?? "America/New_York";
  const sendDays = campaign.send_days ?? ["mon", "tue", "wed", "thu", "fri"];
  const [startH, startM] = (campaign.send_start_time ?? "09:00").split(":").map(Number);

  // Start from now + waitDays
  const base = new Date();
  base.setDate(base.getDate() + waitDays);

  // Walk forward until we land on an allowed day
  for (let i = 0; i < 14; i++) {
    const candidate = new Date(base);
    candidate.setDate(base.getDate() + i);

    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      weekday: "short",
    });
    const weekday = formatter.format(candidate).toLowerCase().slice(0, 3);

    if (sendDays.includes(weekday)) {
      // Set to send_window_start in the campaign's timezone
      // We approximate by building the date with the local offset
      candidate.setHours(startH, startM + Math.floor(Math.random() * 60), 0, 0); // randomize ±30min within window
      return candidate;
    }
  }

  // Fallback: just add waitDays
  const fallback = new Date();
  fallback.setDate(fallback.getDate() + waitDays);
  return fallback;
}

// ─── checkDailyLimits ─────────────────────────────────────────────────────────

/**
 * Returns how many emails this inbox can still send today.
 */
export async function checkDailyLimits(inboxId: string, dailyLimit: number): Promise<number> {
  const supabase = adminClient();
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const { count } = await supabase
    .from("outreach_sends")
    .select("id", { count: "exact", head: true })
    .eq("inbox_id", inboxId)
    .in("status", ["sent", "queued"])
    .gte("created_at", todayStart.toISOString());

  const sent = count ?? 0;
  return Math.max(0, dailyLimit - sent);
}

// ─── markReplied ──────────────────────────────────────────────────────────────

export async function markEnrollmentReplied(enrollmentId: string, sendId: string): Promise<void> {
  const supabase = adminClient();
  const now = new Date().toISOString();

  await Promise.all([
    supabase
      .from("outreach_enrollments")
      .update({ status: "replied" })
      .eq("id", enrollmentId),
    supabase
      .from("outreach_sends")
      .update({ replied_at: now })
      .eq("id", sendId),
  ]);
}

// ─── advanceEnrollment ────────────────────────────────────────────────────────

export async function advanceEnrollment(
  enrollmentId: string,
  nextStep: number,
  nextSendAt: Date | null,
  completed: boolean,
): Promise<void> {
  const supabase = adminClient();
  await supabase
    .from("outreach_enrollments")
    .update({
      current_step: nextStep,
      status: completed ? "completed" : "active",
      next_send_at: nextSendAt?.toISOString() ?? null,
      completed_at: completed ? new Date().toISOString() : null,
    })
    .eq("id", enrollmentId);
}
