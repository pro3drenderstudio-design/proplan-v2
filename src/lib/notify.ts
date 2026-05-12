/**
 * Server-side notification helpers.
 * Import only from API routes (Node.js runtime) — never from client components.
 */
import { createClient } from "@supabase/supabase-js";
import { sendEmail } from "./resend";

// Service-role client — bypasses RLS for lookup queries
const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AQ = any;

const ADMIN_EMAIL = process.env.ADMIN_NOTIFICATION_EMAIL ?? "";
const APP_URL     = process.env.NEXT_PUBLIC_APP_URL ?? "https://app.proplanstudio.com";

// ── Lookup helpers ─────────────────────────────────────────────────────────────

async function builderEmailFromId(builderId: string): Promise<string> {
  const { data } = await (db.from("builders") as AQ)
    .select("contact_email").eq("id", builderId).single();
  return data?.contact_email ?? "";
}

async function builderEmailFromSlug(companySlug: string): Promise<string> {
  const { data } = await (db.from("builders") as AQ)
    .select("contact_email").eq("company_slug", companySlug).single();
  return data?.contact_email ?? "";
}

async function renderRequestInfo(requestId: string): Promise<{
  title: string; builderId: string; builderName: string;
} | null> {
  const { data: req } = await (db.from("render_requests") as AQ)
    .select("title, builder_id, builders(company_name)")
    .eq("id", requestId)
    .single();
  if (!req) return null;
  return {
    title:       req.title ?? "Untitled Render",
    builderId:   req.builder_id,
    builderName: req.builders?.company_name ?? "Builder",
  };
}

async function projectInfo(projectId: string): Promise<{
  name: string; companySlug: string;
} | null> {
  const { data } = await (db.from("projects") as AQ)
    .select("name, company_slug").eq("id", projectId).single();
  if (!data) return null;
  return { name: data.name, companySlug: data.company_slug ?? "" };
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

// ── Builder Account Notifications ─────────────────────────────────────────────

export async function notifyBuilderWelcome(builderId: string) {
  const email = await builderEmailFromId(builderId);
  if (!email) return;
  await sendEmail({
    to:      email,
    subject: "Welcome to ProPlan Studio",
    title:   "Welcome to ProPlan Studio 🎉",
    body: `
      <p>Thanks for joining ProPlan Studio — the platform built for home builders who want to sell smarter.</p>
      <p>Here's what you can do from your dashboard:</p>
      <ul style="margin:12px 0;padding-left:20px;color:#aaa;">
        <li style="margin:6px 0;">Request interactive site maps for your communities</li>
        <li style="margin:6px 0;">Submit 3D render requests and track progress</li>
        <li style="margin:6px 0;">Capture and manage buyer leads</li>
        <li style="margin:6px 0;">Configure your CRM integration</li>
      </ul>
      <p style="margin-top:20px;">
        <a href="${APP_URL}/builder/dashboard"
           style="display:inline-block;background:#2563eb;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:700;">
          Go to Dashboard →
        </a>
      </p>`,
  });
}

export async function notifyAdminNewBuilder(builderId: string, builderName: string, builderEmail: string) {
  if (!ADMIN_EMAIL) return;
  await sendEmail({
    to:      ADMIN_EMAIL,
    subject: `New Builder Signed Up: ${builderName}`,
    title:   "New Builder Account",
    body: `<p>A new builder account has been created on ProPlan Studio.</p>
      <table style="width:100%;border-collapse:collapse;margin:12px 0;">
        <tr><td style="padding:6px 0;color:#999;width:130px;">Name</td><td style="color:#eee;font-weight:600;">${builderName}</td></tr>
        <tr><td style="padding:6px 0;color:#999;">Email</td><td style="color:#eee;">${builderEmail}</td></tr>
        <tr><td style="padding:6px 0;color:#999;">Status</td><td style="color:#f59e0b;font-weight:600;">Trial — awaiting subscription</td></tr>
      </table>
      <p><a href="${APP_URL}/admin/builders/${builderId}" style="color:#3b82f6;">View Builder →</a></p>`,
  });
}

export async function notifyAdminNewSubscription(builderId: string, builderName: string, addonNames: string[], monthlyTotal: number) {
  if (!ADMIN_EMAIL) return;
  const fmtUSD = (n: number) => `$${(n / 100).toLocaleString("en-US", { minimumFractionDigits: 0 })}`;
  const listHtml = addonNames.map(n => `<li style="margin:4px 0;color:#aaa;">${n}</li>`).join("");
  await sendEmail({
    to:      ADMIN_EMAIL,
    subject: `New Subscription: ${builderName} — ${fmtUSD(monthlyTotal)}/mo`,
    title:   "New Subscription Activated",
    body: `<p><strong>${builderName}</strong> just subscribed to ProPlan Studio.</p>
      <ul style="margin:12px 0;padding-left:20px;">${listHtml}</ul>
      <table style="width:100%;border-collapse:collapse;margin:12px 0;">
        <tr><td style="padding:6px 0;color:#999;width:130px;">Monthly Revenue</td><td style="color:#34d399;font-weight:700;font-size:16px;">${fmtUSD(monthlyTotal)}/mo</td></tr>
      </table>
      <p><a href="${APP_URL}/admin/builders/${builderId}" style="color:#3b82f6;">View Builder →</a></p>`,
  });
}

export async function notifyAdminSubscriptionCanceled(builderId: string) {
  if (!ADMIN_EMAIL) return;
  const { data: builder } = await (db.from("builders") as AQ)
    .select("company_name, contact_email").eq("id", builderId).single();
  const name  = builder?.company_name ?? "A builder";
  const email = builder?.contact_email ?? "";
  await sendEmail({
    to:      ADMIN_EMAIL,
    subject: `Subscription Canceled: ${name}`,
    title:   "Subscription Canceled",
    body: `<p><strong>${name}</strong> has canceled their ProPlan Studio subscription.</p>
      <table style="width:100%;border-collapse:collapse;margin:12px 0;">
        <tr><td style="padding:6px 0;color:#999;width:130px;">Email</td><td style="color:#eee;">${email}</td></tr>
      </table>
      <p style="color:#f59e0b;font-size:13px;">Consider reaching out to understand why and offer assistance.</p>
      <p><a href="${APP_URL}/admin/builders/${builderId}" style="color:#3b82f6;">View Builder →</a></p>`,
  });
}

export async function notifyAdminPaymentFailed(builderId: string) {
  if (!ADMIN_EMAIL) return;
  const { data: builder } = await (db.from("builders") as AQ)
    .select("company_name, contact_email").eq("id", builderId).single();
  const name  = builder?.company_name ?? "A builder";
  const email = builder?.contact_email ?? "";
  await sendEmail({
    to:      ADMIN_EMAIL,
    subject: `⚠️ Payment Failed: ${name}`,
    title:   "Payment Failed — Action May Be Required",
    body: `<p>A subscription payment has failed for <strong>${name}</strong>.</p>
      <table style="width:100%;border-collapse:collapse;margin:12px 0;">
        <tr><td style="padding:6px 0;color:#999;width:130px;">Email</td><td style="color:#eee;">${email}</td></tr>
        <tr><td style="padding:6px 0;color:#999;">Status</td><td style="color:#ef4444;font-weight:600;">Past Due</td></tr>
      </table>
      <p style="color:#aaa;font-size:13px;">Stripe will retry automatically. If payment continues to fail, the builder will lose access.</p>
      <p><a href="${APP_URL}/admin/builders/${builderId}" style="color:#3b82f6;">View Builder →</a></p>`,
  });
}

// ── Subscription Notifications ─────────────────────────────────────────────────

export async function notifySubscriptionActivated(builderId: string, addonNames: string[]) {
  const email = await builderEmailFromId(builderId);
  if (!email) return;
  const listHtml = addonNames
    .map(n => `<li style="margin:6px 0;color:#aaa;">${n}</li>`)
    .join("");
  await sendEmail({
    to:      email,
    subject: "Your ProPlan Studio Subscription Is Active",
    title:   "Subscription Activated ✓",
    body: `
      <p>Your ProPlan Studio subscription is now active. Here's what you have access to:</p>
      <ul style="margin:12px 0;padding-left:20px;">${listHtml}</ul>
      <p style="color:#aaa;font-size:13px;">
        Your subscription renews monthly. You can manage it at any time from your settings.
      </p>
      <p style="margin-top:20px;">
        <a href="${APP_URL}/builder/dashboard"
           style="display:inline-block;background:#2563eb;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:700;">
          Go to Dashboard →
        </a>
      </p>`,
  });
}

export async function notifyAddonAdded(builderId: string, addonName: string) {
  const email = await builderEmailFromId(builderId);
  if (!email) return;
  await sendEmail({
    to:      email,
    subject: `${addonName} Added to Your Plan`,
    title:   `${addonName} Activated ✓`,
    body: `
      <p><strong>${addonName}</strong> has been added to your ProPlan Studio plan and is ready to use.</p>
      <p style="margin-top:20px;">
        <a href="${APP_URL}/builder/dashboard"
           style="display:inline-block;background:#2563eb;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:700;">
          Go to Dashboard →
        </a>
      </p>`,
  });
}

export async function notifySubscriptionCanceled(builderId: string) {
  const email = await builderEmailFromId(builderId);
  if (!email) return;
  await sendEmail({
    to:      email,
    subject: "Your ProPlan Studio Subscription Has Been Canceled",
    title:   "Subscription Canceled",
    body: `
      <p>Your ProPlan Studio subscription has been canceled. You will retain access until the end of your current billing period.</p>
      <p style="color:#aaa;font-size:13px;">
        If this was a mistake or you'd like to resubscribe, you can do so at any time from your dashboard.
      </p>
      <p style="margin-top:20px;">
        <a href="${APP_URL}/builder/subscribe"
           style="display:inline-block;background:#2563eb;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:700;">
          Resubscribe →
        </a>
      </p>`,
  });
}

export async function notifySubscriptionPaymentFailed(builderId: string) {
  const email = await builderEmailFromId(builderId);
  if (!email) return;
  await sendEmail({
    to:      email,
    subject: "⚠️ Payment Failed — Action Required",
    title:   "Payment Failed",
    body: `
      <p>We were unable to process payment for your ProPlan Studio subscription.</p>
      <p style="color:#f59e0b;">Please update your payment method to avoid service interruption. We will retry the charge automatically.</p>
      <p style="margin-top:20px;">
        <a href="${APP_URL}/builder/settings?tab=billing"
           style="display:inline-block;background:#dc2626;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:700;">
          Update Payment Method →
        </a>
      </p>`,
  });
}

export async function notifyCreditsLow(
  builderId: string,
  addonName:  string,
  remaining:  number,
  total:      number,
  pct:        number,
) {
  const email = await builderEmailFromId(builderId);
  if (!email) return;
  const isExhausted = remaining === 0;
  await sendEmail({
    to:      email,
    subject: isExhausted
      ? `${addonName} Credits Exhausted`
      : `${addonName} Credits Running Low (${pct}% remaining)`,
    title: isExhausted ? `${addonName} Credits Exhausted` : `${addonName} Credits Running Low`,
    body: `
      <p>Your <strong>${addonName}</strong> credits are ${isExhausted ? "fully exhausted" : "running low"}.</p>
      <table style="width:100%;border-collapse:collapse;margin:12px 0;">
        <tr>
          <td style="padding:6px 0;color:#999;width:130px;">Remaining</td>
          <td style="color:${isExhausted ? "#ef4444" : "#f59e0b"};font-weight:700;">${remaining} / ${total}</td>
        </tr>
      </table>
      ${isExhausted
        ? "<p style=\"color:#ef4444;\">You have no credits left. Purchase more to continue using this service.</p>"
        : "<p>Your credits will reset at the start of your next billing cycle. You can also purchase additional credits now.</p>"}
      <p style="margin-top:20px;">
        <a href="${APP_URL}/builder/settings?tab=billing"
           style="display:inline-block;background:#2563eb;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:700;">
          Manage Plan →
        </a>
      </p>`,
  });
}

export async function notifyRenewalReminder(builderId: string, daysLeft: number, renewalDate: string) {
  const email = await builderEmailFromId(builderId);
  if (!email) return;
  await sendEmail({
    to:      email,
    subject: `Your ProPlan Studio Subscription Renews in ${daysLeft} Days`,
    title:   `Subscription Renews in ${daysLeft} Days`,
    body: `
      <p>This is a reminder that your ProPlan Studio subscription will automatically renew on <strong>${fmtDate(renewalDate)}</strong>.</p>
      <p style="color:#aaa;font-size:13px;">
        No action is needed. To make changes to your plan or update your payment method, visit your billing settings.
      </p>
      <p style="margin-top:20px;">
        <a href="${APP_URL}/builder/settings?tab=billing"
           style="display:inline-block;background:#1a1a1a;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;border:1px solid #333;">
          View Billing Settings →
        </a>
      </p>`,
  });
}

// ── Render Notifications ───────────────────────────────────────────────────────

export async function notifyAdminsNewRenderRequest(requestId: string) {
  if (!ADMIN_EMAIL) return;
  const info = await renderRequestInfo(requestId);
  if (!info) return;
  await sendEmail({
    to: ADMIN_EMAIL,
    subject: `New Render Request: ${info.title}`,
    title: "New Render Request",
    body: `<p><strong>${info.builderName}</strong> submitted a new 3D render request.</p>
      <p>Title: <strong>${info.title}</strong></p>
      <p><a href="${APP_URL}/admin/renders/${requestId}" style="color:#3b82f6;">View Request →</a></p>`,
  });
}

export async function notifyRenderMessageToAdmin(requestId: string, senderName: string, messageBody: string | null) {
  if (!ADMIN_EMAIL) return;
  const info = await renderRequestInfo(requestId);
  if (!info) return;
  await sendEmail({
    to: ADMIN_EMAIL,
    subject: `New Message on Render: ${info.title}`,
    title: "New Message",
    body: `<p><strong>${senderName}</strong> sent a message on render request <strong>${info.title}</strong>.</p>
      ${messageBody ? `<blockquote style="border-left:3px solid #333;margin:12px 0;padding:8px 16px;color:#ccc;">${messageBody}</blockquote>` : ""}
      <p><a href="${APP_URL}/admin/renders/${requestId}" style="color:#3b82f6;">View Conversation →</a></p>`,
  });
}

export async function notifyRenderMessageToBuilder(requestId: string, senderName: string, messageBody: string | null) {
  const info = await renderRequestInfo(requestId);
  if (!info) return;
  const email = await builderEmailFromId(info.builderId);
  if (!email) return;
  await sendEmail({
    to: email,
    subject: `New Message on Your Render: ${info.title}`,
    title: "New Message",
    body: `<p><strong>${senderName}</strong> from ProPlan Studio sent a message on your render <strong>${info.title}</strong>.</p>
      ${messageBody ? `<blockquote style="border-left:3px solid #333;margin:12px 0;padding:8px 16px;color:#ccc;">${messageBody}</blockquote>` : ""}
      <p><a href="${APP_URL}/builder/3d-projects/${requestId}" style="color:#3b82f6;">View Conversation →</a></p>`,
  });
}

export async function notifyRenderDelivery(requestId: string) {
  const info = await renderRequestInfo(requestId);
  if (!info) return;
  const email = await builderEmailFromId(info.builderId);
  if (!email) return;
  await sendEmail({
    to: email,
    subject: `Your Render Is Ready: ${info.title}`,
    title: "Render Delivered 🎉",
    body: `<p>Great news! Your render <strong>${info.title}</strong> has been delivered and is ready for your review.</p>
      <p><a href="${APP_URL}/builder/3d-projects/${requestId}" style="color:#3b82f6;">Review & Accept Delivery →</a></p>`,
  });
}

export async function notifyRenderRevision(requestId: string) {
  if (!ADMIN_EMAIL) return;
  const info = await renderRequestInfo(requestId);
  if (!info) return;
  await sendEmail({
    to: ADMIN_EMAIL,
    subject: `Revision Requested: ${info.title}`,
    title: "Revision Requested",
    body: `<p><strong>${info.builderName}</strong> has requested a revision on render <strong>${info.title}</strong>.</p>
      <p><a href="${APP_URL}/admin/renders/${requestId}" style="color:#3b82f6;">View Request →</a></p>`,
  });
}

export async function notifyRenderDateProposal(requestId: string, date: string) {
  const info = await renderRequestInfo(requestId);
  if (!info) return;
  const email = await builderEmailFromId(info.builderId);
  if (!email) return;
  await sendEmail({
    to: email,
    subject: `Completion Date Proposed for ${info.title}`,
    title: "Completion Date Proposed",
    body: `<p>ProPlan Studio has proposed a completion date of <strong>${fmtDate(date)}</strong> for your render <strong>${info.title}</strong>.</p>
      <p><a href="${APP_URL}/builder/3d-projects/${requestId}" style="color:#3b82f6;">Accept or Counter →</a></p>`,
  });
}

export async function notifyRenderDateAccepted(requestId: string, date: string) {
  if (!ADMIN_EMAIL) return;
  const info = await renderRequestInfo(requestId);
  if (!info) return;
  await sendEmail({
    to: ADMIN_EMAIL,
    subject: `Completion Date Accepted: ${info.title}`,
    title: "Completion Date Accepted ✓",
    body: `<p><strong>${info.builderName}</strong> accepted the proposed completion date of <strong>${fmtDate(date)}</strong> for render <strong>${info.title}</strong>.</p>
      <p><a href="${APP_URL}/admin/renders/${requestId}" style="color:#3b82f6;">View Request →</a></p>`,
  });
}

export async function notifyRenderCounterProposed(requestId: string, date: string) {
  if (!ADMIN_EMAIL) return;
  const info = await renderRequestInfo(requestId);
  if (!info) return;
  await sendEmail({
    to: ADMIN_EMAIL,
    subject: `Counter-Date Proposed: ${info.title}`,
    title: "Counter-Proposal Received",
    body: `<p><strong>${info.builderName}</strong> declined the proposed date and counter-proposed <strong>${fmtDate(date)}</strong> for render <strong>${info.title}</strong>.</p>
      <p><a href="${APP_URL}/admin/renders/${requestId}" style="color:#3b82f6;">Accept or Re-propose →</a></p>`,
  });
}

export async function notifyRenderCounterAccepted(requestId: string, date: string) {
  const info = await renderRequestInfo(requestId);
  if (!info) return;
  const email = await builderEmailFromId(info.builderId);
  if (!email) return;
  await sendEmail({
    to: email,
    subject: `Your Counter-Proposal Accepted: ${info.title}`,
    title: "Counter-Proposal Accepted ✓",
    body: `<p>ProPlan Studio accepted your counter-proposed completion date of <strong>${fmtDate(date)}</strong> for render <strong>${info.title}</strong>.</p>
      <p><a href="${APP_URL}/builder/3d-projects/${requestId}" style="color:#3b82f6;">View Render →</a></p>`,
  });
}

export async function notifyRenderDeliveryAccepted(requestId: string) {
  if (!ADMIN_EMAIL) return;
  const info = await renderRequestInfo(requestId);
  if (!info) return;
  await sendEmail({
    to: ADMIN_EMAIL,
    subject: `Delivery Accepted: ${info.title}`,
    title: "Delivery Accepted ✓",
    body: `<p><strong>${info.builderName}</strong> accepted the delivery and marked render <strong>${info.title}</strong> as completed.</p>
      <p><a href="${APP_URL}/admin/renders/${requestId}" style="color:#3b82f6;">View Request →</a></p>`,
  });
}

// ── Setup Fee / Payment Reminders ─────────────────────────────────────────────

export async function notifyPaymentReminder(
  builderEmail: string,
  modelName: string,
  reminderNumber: number,
) {
  if (!builderEmail) return;
  const daysLeft = 3 - reminderNumber;
  const urgency  = reminderNumber === 3 ? "⚠️ Final Notice" : `Reminder ${reminderNumber} of 3`;
  const deleteWarning = daysLeft > 0
    ? `<p style="color:#f59e0b;">Your setup request will be automatically deleted in <strong>${daysLeft} day${daysLeft > 1 ? "s" : ""}</strong> if payment is not completed.</p>`
    : `<p style="color:#ef4444;"><strong>This is your final reminder.</strong> Your setup request will be deleted tomorrow if payment is not completed.</p>`;

  await sendEmail({
    to:      builderEmail,
    subject: `${urgency}: Complete Payment for "${modelName}" Model Setup`,
    title:   "Action Required — Complete Your Model Setup",
    body: `
      <p>You have a pending 3D configurator setup that requires payment to enter production.</p>
      <p><strong>Model:</strong> ${modelName}</p>
      <p><strong>Setup Fee:</strong> $1,000 (one-time)</p>
      ${deleteWarning}
      <p style="margin-top:20px;">
        <a href="${APP_URL}/builder/projects"
           style="display:inline-block;background:#2563eb;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:700;">
          Complete Payment →
        </a>
      </p>
      <p style="color:#666;font-size:12px;margin-top:16px;">
        Once payment is received, your model setup enters the production queue and our team will be in touch within 1–2 business days.
      </p>`,
  });
}

// ── Lead Notifications ────────────────────────────────────────────────────────

export async function notifyNewLead(
  projectId: string,
  lead: { firstName: string; lastName: string; email: string; phone: string | null; totalValue: number }
) {
  const info = await projectInfo(projectId);
  if (!info) return;
  const { data: builder } = await (db.from("builders") as AQ)
    .select("contact_email, notification_prefs")
    .eq("company_slug", info.companySlug)
    .single();
  if (!builder?.contact_email) return;
  if (builder.notification_prefs?.new_lead === false) return;

  const fmtUSD = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

  await sendEmail({
    to:      builder.contact_email,
    subject: `New Lead: ${lead.firstName} ${lead.lastName} — ${info.name}`,
    title:   "New Lead Submitted 🎉",
    body: `
      <p>Someone just submitted a configuration quote for <strong>${info.name}</strong>.</p>
      <table style="width:100%;border-collapse:collapse;margin:12px 0;">
        <tr><td style="padding:6px 0;color:#999;width:130px;">Name</td><td style="color:#eee;font-weight:600;">${lead.firstName} ${lead.lastName}</td></tr>
        <tr><td style="padding:6px 0;color:#999;">Email</td><td style="color:#eee;">${lead.email}</td></tr>
        ${lead.phone ? `<tr><td style="padding:6px 0;color:#999;">Phone</td><td style="color:#eee;">${lead.phone}</td></tr>` : ""}
        <tr><td style="padding:6px 0;color:#999;">Quote Value</td><td style="color:#3b82f6;font-weight:700;font-size:18px;">${fmtUSD(lead.totalValue)}</td></tr>
      </table>
      <p><a href="${APP_URL}/builder/leads" style="color:#3b82f6;">View in Lead CRM →</a></p>`,
  });
}

// ── Project (Production Queue) Notifications ───────────────────────────────────

export async function notifyAdminsNewProjectRequest(projectId: string) {
  if (!ADMIN_EMAIL) return;
  const info = await projectInfo(projectId);
  if (!info) return;
  await sendEmail({
    to: ADMIN_EMAIL,
    subject: `New Model Request: ${info.name}`,
    title: "New 3D Model Request",
    body: `<p>A new 3D configurator model has been requested: <strong>${info.name}</strong>.</p>
      <p><a href="${APP_URL}/admin/requests/${projectId}" style="color:#3b82f6;">View Request →</a></p>`,
  });
}

export async function notifyProjectStatusChange(projectId: string, newStatus: string) {
  const info = await projectInfo(projectId);
  if (!info) return;
  // Check notification_prefs
  const { data: builder } = await (db.from("builders") as AQ)
    .select("contact_email, notification_prefs")
    .eq("company_slug", info.companySlug)
    .single();
  if (!builder?.contact_email) return;
  if (builder.notification_prefs?.project_update === false) return;
  const email = builder.contact_email as string;
  const statusLabels: Record<string, string> = {
    pending_review: "Pending Review",
    in_development: "In Development",
    in_review:      "In Review / Node Mapping",
    live:           "Live",
    archived:       "Archived",
  };
  const label = statusLabels[newStatus] ?? newStatus;
  await sendEmail({
    to: email,
    subject: `Model Status Updated: ${info.name}`,
    title: "Project Status Updated",
    body: `<p>Your model <strong>${info.name}</strong> has been moved to <strong>${label}</strong>.</p>
      <p><a href="${APP_URL}/builder/projects/requests/${projectId}" style="color:#3b82f6;">View Project →</a></p>`,
  });
}

export async function notifyProjectMessageToAdmin(projectId: string, senderName: string, messageBody: string | null) {
  if (!ADMIN_EMAIL) return;
  const info = await projectInfo(projectId);
  if (!info) return;
  await sendEmail({
    to: ADMIN_EMAIL,
    subject: `New Message on Project: ${info.name}`,
    title: "New Message",
    body: `<p><strong>${senderName}</strong> sent a message on project <strong>${info.name}</strong>.</p>
      ${messageBody ? `<blockquote style="border-left:3px solid #333;margin:12px 0;padding:8px 16px;color:#ccc;">${messageBody}</blockquote>` : ""}
      <p><a href="${APP_URL}/admin/requests/${projectId}" style="color:#3b82f6;">View Conversation →</a></p>`,
  });
}

export async function notifyProjectMessageToBuilder(projectId: string, senderName: string, messageBody: string | null) {
  const info = await projectInfo(projectId);
  if (!info) return;
  const email = await builderEmailFromSlug(info.companySlug);
  if (!email) return;
  await sendEmail({
    to: email,
    subject: `New Message on Your Project: ${info.name}`,
    title: "New Message",
    body: `<p><strong>${senderName}</strong> from ProPlan Studio sent a message on project <strong>${info.name}</strong>.</p>
      ${messageBody ? `<blockquote style="border-left:3px solid #333;margin:12px 0;padding:8px 16px;color:#ccc;">${messageBody}</blockquote>` : ""}
      <p><a href="${APP_URL}/builder/projects/requests/${projectId}" style="color:#3b82f6;">View Conversation →</a></p>`,
  });
}

// ── Site Map Request Notifications ────────────────────────────────────────────

export async function notifyAdminsSiteMapRequest(requestId: string) {
  if (!ADMIN_EMAIL) return;
  const { data: req } = await (db.from("site_map_requests") as AQ)
    .select("community_name, builder_id, builders(company_name)")
    .eq("id", requestId)
    .single();
  if (!req) return;
  const builderName = (req.builders as { company_name?: string } | null)?.company_name ?? "A builder";
  await sendEmail({
    to: ADMIN_EMAIL,
    subject: `New Site Map Request: ${req.community_name}`,
    title: "New Interactive Site Map Request",
    body: `<p><strong>${builderName}</strong> submitted a new Interactive Site Map request for <strong>${req.community_name}</strong>. Setup fee has been paid.</p>
      <p><a href="${APP_URL}/admin/requests?tab=site-maps" style="color:#3b82f6;">Review Request →</a></p>`,
  });
}

export async function notifySiteMapComplete(requestId: string) {
  const { data: req } = await (db.from("site_map_requests") as AQ)
    .select("community_name, builder_id")
    .eq("id", requestId)
    .single();
  if (!req) return;
  const email = await builderEmailFromId(req.builder_id);
  if (!email) return;
  await sendEmail({
    to: email,
    subject: `Your Site Map Is Ready: ${req.community_name}`,
    title: "Interactive Site Map Complete 🎉",
    body: `<p>Your interactive site map for <strong>${req.community_name}</strong> has been completed and is ready to use.</p>
      <p><a href="${APP_URL}/builder/communities" style="color:#3b82f6;">View in Communities →</a></p>`,
  });
}
