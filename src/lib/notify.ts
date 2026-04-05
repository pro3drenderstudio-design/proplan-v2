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
  const email = await builderEmailFromSlug(info.companySlug);
  if (!email) return;
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
