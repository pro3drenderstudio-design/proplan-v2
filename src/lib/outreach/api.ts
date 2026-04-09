import type {
  OutreachInboxSafe, OutreachList, OutreachCampaign,
  OutreachSequenceStep, ImportResult, CrmThread, InboxImportResult,
  OutreachTemplate, CampaignAnalytics, OutreachReply, OutreachCrmFilter,
} from "@/types/outreach";

const base = "/api/outreach";

// ─── Inboxes ──────────────────────────────────────────────────────────────────

export async function getInboxes(): Promise<OutreachInboxSafe[]> {
  const r = await fetch(`${base}/inboxes`); return r.json();
}
export async function updateInbox(id: string, data: Record<string, unknown>) {
  const r = await fetch(`${base}/inboxes/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
  return r.json();
}
export async function deleteInbox(id: string) {
  return fetch(`${base}/inboxes/${id}`, { method: "DELETE" });
}
export async function createSmtpInbox(data: Record<string, unknown>) {
  const r = await fetch(`${base}/inboxes`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
  return r.json();
}
export async function importInboxes(file: File): Promise<InboxImportResult> {
  const fd = new FormData();
  fd.append("file", file);
  const r = await fetch(`${base}/inboxes/import`, { method: "POST", body: fd });
  return r.json();
}

// ─── Lists ────────────────────────────────────────────────────────────────────

export async function getLists(): Promise<OutreachList[]> {
  const r = await fetch(`${base}/lists`); return r.json();
}
export async function createList(name: string, description?: string): Promise<OutreachList> {
  const r = await fetch(`${base}/lists`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, description }) });
  return r.json();
}
export async function getList(id: string): Promise<OutreachList & { leads: unknown[] }> {
  const r = await fetch(`${base}/lists/${id}`); return r.json();
}
export async function deleteList(id: string) {
  return fetch(`${base}/lists/${id}`, { method: "DELETE" });
}

// ─── Import ───────────────────────────────────────────────────────────────────

export async function importLeads(file: File, listId: string, mapping: unknown[]): Promise<ImportResult> {
  const fd = new FormData();
  fd.append("file", file);
  fd.append("list_id", listId);
  fd.append("mapping", JSON.stringify(mapping));
  const r = await fetch(`${base}/leads/import`, { method: "POST", body: fd });
  return r.json();
}

// ─── Campaigns ────────────────────────────────────────────────────────────────

export async function getCampaigns(): Promise<OutreachCampaign[]> {
  const r = await fetch(`${base}/campaigns`); return r.json();
}
export async function getCampaign(id: string): Promise<OutreachCampaign> {
  const r = await fetch(`${base}/campaigns/${id}`); return r.json();
}
export async function createCampaign(data: Partial<OutreachCampaign>): Promise<OutreachCampaign> {
  const r = await fetch(`${base}/campaigns`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
  return r.json();
}
export async function updateCampaign(id: string, data: Partial<OutreachCampaign>): Promise<OutreachCampaign> {
  const r = await fetch(`${base}/campaigns/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
  return r.json();
}
export async function deleteCampaign(id: string) {
  return fetch(`${base}/campaigns/${id}`, { method: "DELETE" });
}
export async function enrollLeads(campaignId: string, listId: string): Promise<{ enrolled: number }> {
  const r = await fetch(`${base}/campaigns/${campaignId}/enroll`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ list_id: listId }) });
  return r.json();
}

// ─── Sequences ────────────────────────────────────────────────────────────────

export async function getSequence(campaignId: string): Promise<OutreachSequenceStep[]> {
  const r = await fetch(`${base}/sequences/${campaignId}`); return r.json();
}
export async function saveSequence(campaignId: string, steps: Partial<OutreachSequenceStep>[]) {
  const r = await fetch(`${base}/sequences/${campaignId}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ steps }) });
  return r.json();
}

// ─── CRM ──────────────────────────────────────────────────────────────────────

// ─── Templates ────────────────────────────────────────────────────────────────

export async function getTemplates(): Promise<OutreachTemplate[]> {
  const r = await fetch(`${base}/templates`); return r.json();
}
export async function createTemplate(name: string, subject: string, body: string): Promise<OutreachTemplate> {
  const r = await fetch(`${base}/templates`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, subject, body }) });
  return r.json();
}
export async function deleteTemplate(id: string) {
  return fetch(`${base}/templates/${id}`, { method: "DELETE" });
}

// ─── Campaign Clone ───────────────────────────────────────────────────────────

export async function cloneCampaign(id: string): Promise<OutreachCampaign> {
  const r = await fetch(`${base}/campaigns/${id}/clone`, { method: "POST" });
  return r.json();
}
export async function getCampaignAnalytics(id: string): Promise<CampaignAnalytics> {
  const r = await fetch(`${base}/campaigns/${id}/analytics`); return r.json();
}

// ─── CRM ──────────────────────────────────────────────────────────────────────

export async function getCrmThreads(offset = 0): Promise<CrmThread[]> {
  const r = await fetch(`${base}/crm?offset=${offset}`); return r.json();
}
export async function addNote(enrollmentId: string, body: string, authorId?: string) {
  const r = await fetch(`${base}/crm/${enrollmentId}/notes`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ body, author_id: authorId }) });
  return r.json();
}
export async function updateCrmStatus(enrollmentId: string, crm_status: string) {
  const r = await fetch(`${base}/crm/${enrollmentId}/status`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ crm_status }) });
  return r.json();
}
export async function suggestReply(enrollmentId: string): Promise<{ suggestion?: string; error?: string }> {
  const r = await fetch(`${base}/crm/${enrollmentId}/suggest-reply`, { method: "POST" });
  return r.json();
}
export async function generateSequence(params: { product_name: string; target_audience: string; value_prop: string; tone?: string; num_emails?: number; wait_days_between?: number }) {
  const r = await fetch(`${base}/campaigns/generate-sequence`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(params) });
  return r.json();
}
export async function sendTestEmail(params: { inbox_id: string; to_email: string; subject_template: string; body_template: string; lead_id?: string; variables?: Record<string, string> }) {
  const r = await fetch(`${base}/sequences/test-send`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(params) });
  return r.json();
}
// ─── CRM: Unmatched replies + filters + manual match ─────────────────────────

export async function getCrmUnmatched(): Promise<(OutreachReply & { inbox: { id: string; label: string | null; email_address: string } | null })[]> {
  const r = await fetch(`${base}/crm/unmatched`); return r.json();
}
export async function ignoreCrmUnmatched(id: string) {
  return fetch(`${base}/crm/unmatched`, { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
}
export async function getCrmFilters(): Promise<OutreachCrmFilter[]> {
  const r = await fetch(`${base}/crm/filters`); return r.json();
}
export async function createCrmFilter(data: Omit<OutreachCrmFilter, "id" | "created_at">): Promise<OutreachCrmFilter> {
  const r = await fetch(`${base}/crm/filters`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
  return r.json();
}
export async function deleteCrmFilter(id: string) {
  return fetch(`${base}/crm/filters?id=${id}`, { method: "DELETE" });
}
export async function matchReply(replyId: string, enrollmentId: string) {
  return fetch(`${base}/crm/replies/${replyId}/match`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ enrollment_id: enrollmentId }) });
}

export async function sendCrmReply(enrollmentId: string, body: string): Promise<{ ok?: boolean; error?: string }> {
  const r = await fetch(`${base}/crm/${enrollmentId}/reply`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ body }) });
  return r.json();
}

export async function triggerSendBatch(): Promise<{
  sends:   { sent: number; skipped: number; errors: number; processed: number };
  replies: { inboxes: number; matched: number; unmatched: number; filtered: number; details: Array<{ email: string; fetched: number; matched: number; unmatched: number; error?: string }> };
}> {
  const r = await fetch(`${base}/run-sends`, { method: "POST" });
  return r.json();
}
