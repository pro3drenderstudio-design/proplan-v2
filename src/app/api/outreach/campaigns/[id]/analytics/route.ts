import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function supabase() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: campaignId } = await params;
  const db = supabase();

  // Run all queries in parallel
  const [
    enrollmentsRes,
    sequenceRes,
    sendsRes,
    queueRes,
  ] = await Promise.all([
    // All enrollments for this campaign
    db.from("outreach_enrollments")
      .select("id, status, ab_variant, crm_status, current_step, next_send_at, lead:outreach_leads(first_name, last_name, email, company)")
      .eq("campaign_id", campaignId),

    // All sequence steps
    db.from("outreach_sequences")
      .select("id, step_order, type, subject_template, subject_template_b, wait_days")
      .eq("campaign_id", campaignId)
      .order("step_order"),

    // All sends for this campaign (via enrollment join)
    db.from("outreach_sends")
      .select("id, enrollment_id, sequence_step_id, status, sent_at, opened_at, open_count, clicked_at, replied_at, bounced_at, subject, to_email")
      .in("enrollment_id",
        (await db.from("outreach_enrollments").select("id").eq("campaign_id", campaignId)).data?.map(e => e.id) ?? []
      )
      .order("sent_at", { ascending: false }),

    // Upcoming queue (active enrollments with next_send_at)
    db.from("outreach_enrollments")
      .select("id, current_step, next_send_at, crm_status, lead:outreach_leads(first_name, last_name, email, company)")
      .eq("campaign_id", campaignId)
      .eq("status", "active")
      .order("next_send_at", { ascending: true })
      .limit(50),
  ]);

  const enrollments = enrollmentsRes.data ?? [];
  const steps       = sequenceRes.data ?? [];
  const sends       = sendsRes.data ?? [];
  const queue       = queueRes.data ?? [];

  // ── Funnel ────────────────────────────────────────────────────────────────
  const statusCounts: Record<string, number> = {};
  for (const e of enrollments) {
    statusCounts[e.status] = (statusCounts[e.status] ?? 0) + 1;
  }
  const enrollmentIds = new Set(enrollments.map(e => e.id));
  const openedEnrollments = new Set(
    sends.filter(s => s.opened_at).map(s => s.enrollment_id)
  );

  const funnel = {
    enrolled:     enrollments.length,
    active:       statusCounts["active"]       ?? 0,
    sent:         sends.filter(s => s.status === "sent").length,
    opened:       openedEnrollments.size,
    replied:      statusCounts["replied"]       ?? 0,
    completed:    statusCounts["completed"]     ?? 0,
    bounced:      statusCounts["bounced"]       ?? 0,
    unsubscribed: statusCounts["unsubscribed"]  ?? 0,
  };

  // ── Per-step stats ────────────────────────────────────────────────────────
  // Build map from sequence_step_id → step_order for sends
  const stepById = new Map(steps.map(s => [s.id, s]));

  // Group sends by sequence_step_id
  const sendsByStep = new Map<string, typeof sends>();
  for (const s of sends) {
    if (!s.sequence_step_id) continue;
    if (!sendsByStep.has(s.sequence_step_id)) sendsByStep.set(s.sequence_step_id, []);
    sendsByStep.get(s.sequence_step_id)!.push(s);
  }

  const per_step = steps.map(step => {
    const stepSends = sendsByStep.get(step.id) ?? [];
    const sent    = stepSends.filter(s => s.status === "sent").length;
    const opened  = stepSends.filter(s => s.opened_at).length;
    const replied = stepSends.filter(s => s.replied_at).length;
    const bounced = stepSends.filter(s => s.status === "bounced").length;
    return {
      step_order:         step.step_order,
      type:               step.type,
      subject_template:   step.subject_template ?? "",
      subject_template_b: step.subject_template_b ?? null,
      sent,
      opened,
      open_rate:   sent > 0 ? Math.round((opened / sent) * 1000) / 10 : 0,
      replied,
      reply_rate:  sent > 0 ? Math.round((replied / sent) * 1000) / 10 : 0,
      bounced,
    };
  });

  // ── Daily activity (last 30 days) ─────────────────────────────────────────
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const recentSends = sends.filter(s => s.sent_at && new Date(s.sent_at) >= thirtyDaysAgo);

  const dailyMap = new Map<string, { sent: number; opened: number; replied: number }>();
  for (const s of recentSends) {
    if (!s.sent_at) continue;
    const date = s.sent_at.slice(0, 10); // YYYY-MM-DD
    if (!dailyMap.has(date)) dailyMap.set(date, { sent: 0, opened: 0, replied: 0 });
    const d = dailyMap.get(date)!;
    if (s.status === "sent") d.sent++;
    if (s.opened_at) d.opened++;
    if (s.replied_at) d.replied++;
  }

  // Fill in all 30 days (including zeros)
  const daily_activity = [];
  for (let i = 29; i >= 0; i--) {
    const date = new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const d = dailyMap.get(date) ?? { sent: 0, opened: 0, replied: 0 };
    daily_activity.push({ date, ...d });
  }

  // ── A/B test ─────────────────────────────────────────────────────────────
  const hasAbSteps = steps.some(s => s.subject_template_b);
  const enrollmentAbVariant = new Map(enrollments.map(e => [e.id, e.ab_variant ?? "a"]));

  const abGroups = { a: { sent: 0, opened: 0, replied: 0 }, b: { sent: 0, opened: 0, replied: 0 } };
  for (const s of sends) {
    const variant = enrollmentAbVariant.get(s.enrollment_id) ?? "a";
    const g = abGroups[variant as "a" | "b"] ?? abGroups.a;
    if (s.status === "sent") g.sent++;
    if (s.opened_at) g.opened++;
    if (s.replied_at) g.replied++;
  }

  const ab_test = {
    enabled: hasAbSteps,
    a: { ...abGroups.a, open_rate: abGroups.a.sent > 0 ? Math.round((abGroups.a.opened / abGroups.a.sent) * 1000) / 10 : 0, reply_rate: abGroups.a.sent > 0 ? Math.round((abGroups.a.replied / abGroups.a.sent) * 1000) / 10 : 0 },
    b: { ...abGroups.b, open_rate: abGroups.b.sent > 0 ? Math.round((abGroups.b.opened / abGroups.b.sent) * 1000) / 10 : 0, reply_rate: abGroups.b.sent > 0 ? Math.round((abGroups.b.replied / abGroups.b.sent) * 1000) / 10 : 0 },
  };

  // ── Recent activity (last 30 sends) ──────────────────────────────────────
  // Build enrollment→lead map
  const enrollmentLeadMap = new Map(enrollments.map(e => [e.id, e.lead as { first_name?: string; last_name?: string; email: string; company?: string }]));

  const recent_activity = sends.slice(0, 30).map(s => {
    const lead = enrollmentLeadMap.get(s.enrollment_id);
    const step = stepById.get(s.sequence_step_id ?? "");
    return {
      send_id:    s.id,
      lead_name:  [lead?.first_name, lead?.last_name].filter(Boolean).join(" ") || s.to_email,
      lead_email: lead?.email ?? s.to_email,
      company:    lead?.company ?? null,
      subject:    s.subject ?? "",
      status:     s.status,
      step_order: step?.step_order ?? 0,
      sent_at:    s.sent_at ?? null,
      opened_at:  s.opened_at ?? null,
      replied_at: s.replied_at ?? null,
    };
  });

  // ── Upcoming queue ────────────────────────────────────────────────────────
  const upcoming_queue = queue.map(e => {
    const lead = e.lead as { first_name?: string; last_name?: string; email: string; company?: string };
    return {
      enrollment_id: e.id,
      lead_name:     [lead?.first_name, lead?.last_name].filter(Boolean).join(" ") || lead?.email,
      lead_email:    lead?.email ?? "",
      company:       lead?.company ?? null,
      current_step:  e.current_step ?? 0,
      next_send_at:  e.next_send_at ?? null,
      crm_status:    e.crm_status ?? "neutral",
    };
  });

  return NextResponse.json({ funnel, per_step, daily_activity, ab_test, recent_activity, upcoming_queue });
}
