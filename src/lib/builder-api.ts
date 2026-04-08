import { supabase } from "@/lib/supabase";
import {
  Project, ProjectRequest, Lead, LeadStatus,
  Category, Option, CategoryWithOptions, ProjectFile,
  RenderRequest, RenderRequestType, RenderRequestPriority,
  Plan, Builder, RenderMessage, RenderMessageAttachment,
} from "@/types/database";

export type { RenderRequest, RenderRequestType, RenderRequestPriority, Plan, Builder, RenderMessage, RenderMessageAttachment };

export type { ProjectRequest, Lead, LeadStatus };

export type NewProjectRequest = Omit<ProjectRequest, "id" | "status" | "created_at" | "updated_at">;

// Supabase @postgrest-js v2 conditional type inference only works with generated types.
// For insert/update operations we cast the query builder to `any`.
type AnyQuery = any; // eslint-disable-line @typescript-eslint/no-explicit-any

// ── Project Requests ──────────────────────────────────────────────────────────

export async function getProjectRequests(): Promise<ProjectRequest[]> {
  const builderId = await getBuilderId();
  if (!builderId) return [];
  const { data, error } = await supabase
    .from("project_requests")
    .select("*")
    .eq("builder_id", builderId)
    .order("created_at", { ascending: false });
  if (error) { console.error("getProjectRequests:", error.message); return []; }
  return data as ProjectRequest[];
}

export async function createProjectRequest(
  req: NewProjectRequest,
): Promise<ProjectRequest | null> {
  const builderId = await getBuilderId();

  const { data, error } = await (supabase.from("project_requests") as AnyQuery)
    .insert({ ...req, status: "awaiting_payment", builder_id: builderId, payment_reminders_sent: 0 })
    .select()
    .single();
  if (error) { console.error("createProjectRequest:", error.message); return null; }

  return data as ProjectRequest;
}

export async function initiateSetupFeeCheckout(requestId: string): Promise<string | null> {
  try {
    const res = await fetch("/api/stripe/setup-fee", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ requestId }),
    });
    const { url, error } = await res.json();
    if (error || !url) { console.error("initiateSetupFeeCheckout:", error); return null; }
    return url as string;
  } catch (e) {
    console.error("initiateSetupFeeCheckout:", e);
    return null;
  }
}

// ── Projects ──────────────────────────────────────────────────────────────────

// Impersonation: admin can set this key in localStorage to view as a specific builder
export const IMPERSONATE_KEY = "proplan_impersonate_builder_id";

async function getBuilderCompanySlug(): Promise<string | null> {
  try {
    // Check if admin is impersonating a builder
    if (typeof window !== "undefined") {
      const impersonateId = window.localStorage.getItem(IMPERSONATE_KEY);
      if (impersonateId) {
        const { data: builder } = await (supabase as AnyQuery)
          .from("builders").select("company_slug").eq("id", impersonateId).single();
        if (builder?.company_slug) return builder.company_slug;
      }
    }
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    const { data: profile } = await (supabase as AnyQuery)
      .from("profiles").select("builder_id").eq("id", user.id).single();
    if (!profile?.builder_id) return null;
    const { data: builder } = await (supabase as AnyQuery)
      .from("builders").select("company_slug").eq("id", profile.builder_id).single();
    return builder?.company_slug ?? null;
  } catch { return null; }
}

export async function getImpersonatedBuilder(): Promise<{ id: string; company_name: string } | null> {
  if (typeof window === "undefined") return null;
  const id = window.localStorage.getItem(IMPERSONATE_KEY);
  if (!id) return null;
  const { data } = await (supabase as AnyQuery)
    .from("builders").select("id, company_name").eq("id", id).single();
  return data ?? null;
}

export async function getBuilderProjects(): Promise<Project[]> {
  const slug = await getBuilderCompanySlug();
  if (!slug) return [];
  const { data, error } = await supabase
    .from("projects")
    .select("*")
    .eq("company_slug", slug)
    .order("created_at", { ascending: false });
  if (error) { console.error("getBuilderProjects:", error.message); return []; }
  return data as Project[];
}

export async function getProjectById(id: string): Promise<Project | null> {
  const { data, error } = await supabase
    .from("projects")
    .select("*")
    .eq("id", id)
    .single();
  if (error) { console.error("getProjectById:", error.message); return null; }
  return data as Project;
}

/** Update project metadata via server-side API route (uses service role). */
export async function updateProjectMeta(
  id: string,
  updates: Partial<Omit<Project, "id" | "created_at" | "updated_at">>,
): Promise<boolean> {
  const res = await fetch(`/api/projects/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(updates),
  });
  return res.ok;
}

// ── Project Files ─────────────────────────────────────────────────────────────

export async function getProjectFiles(projectId: string): Promise<ProjectFile[]> {
  const { data, error } = await supabase
    .from("project_files")
    .select("*")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });
  if (error) { console.error("getProjectFiles:", error.message); return []; }
  return data as ProjectFile[];
}

export async function deleteProjectFile(fileId: string): Promise<boolean> {
  const res = await fetch(`/api/project-files/${fileId}`, { method: "DELETE" });
  return res.ok;
}

// ── Categories ────────────────────────────────────────────────────────────────

export async function getProjectCategoriesWithOptions(
  projectId: string,
): Promise<CategoryWithOptions[]> {
  const { data, error } = await supabase
    .from("categories")
    .select("*, options(*)")
    .eq("project_id", projectId)
    .order("sort_order")
    .order("sort_order", { referencedTable: "options" });
  if (error) { console.error("getProjectCategoriesWithOptions:", error.message); return []; }
  return (data ?? []) as CategoryWithOptions[];
}

export async function createCategory(
  data: Pick<Category, "project_id" | "name" | "phase" | "sort_order"> & Partial<Category>,
): Promise<Category | null> {
  const { data: row, error } = await (supabase.from("categories") as AnyQuery)
    .insert({ is_mandatory: false, default_option: null, camera_override: null, ...data })
    .select()
    .single();
  if (error) { console.error("createCategory:", error.message); return null; }
  return row as Category;
}

export async function updateCategory(
  id: string,
  updates: Partial<Pick<Category, "name" | "phase" | "sort_order" | "is_mandatory">>,
): Promise<boolean> {
  const { error } = await (supabase.from("categories") as AnyQuery)
    .update(updates)
    .eq("id", id);
  if (error) { console.error("updateCategory:", error.message); return false; }
  return true;
}

export async function deleteCategory(id: string): Promise<boolean> {
  const { error } = await (supabase.from("categories") as AnyQuery)
    .delete()
    .eq("id", id);
  if (error) { console.error("deleteCategory:", error.message); return false; }
  return true;
}

// ── Options ───────────────────────────────────────────────────────────────────

export async function createOption(
  data: Pick<Option, "category_id" | "friendly_name" | "price_impact" | "sort_order"> & Partial<Option>,
): Promise<Option | null> {
  const { data: row, error } = await (supabase.from("options") as AnyQuery)
    .insert({ node_list: [], node_conditions: {}, ...data })
    .select()
    .single();
  if (error) { console.error("createOption:", error.message); return null; }
  return row as Option;
}

export async function updateOption(
  id: string,
  updates: Partial<Pick<Option, "friendly_name" | "price_impact" | "sort_order" | "thumbnail_url">>,
): Promise<boolean> {
  const { error } = await (supabase.from("options") as AnyQuery)
    .update(updates)
    .eq("id", id);
  if (error) { console.error("updateOption:", error.message); return false; }
  return true;
}

export async function deleteOption(id: string): Promise<boolean> {
  const { error } = await (supabase.from("options") as AnyQuery)
    .delete()
    .eq("id", id);
  if (error) { console.error("deleteOption:", error.message); return false; }
  return true;
}

// ── Leads ─────────────────────────────────────────────────────────────────────

export async function getLeadById(id: string): Promise<Lead | null> {
  const { data, error } = await (supabase.from("leads") as AnyQuery)
    .select("*")
    .eq("id", id)
    .single();
  if (error) { console.error("getLeadById:", error.message); return null; }
  return data as Lead;
}

export async function getLeads(): Promise<Lead[]> {
  const slug = await getBuilderCompanySlug();
  if (!slug) return [];
  // Get all project IDs for this builder first
  const { data: projects } = await supabase
    .from("projects").select("id").eq("company_slug", slug);
  const ids = (projects ?? []).map((p: { id: string }) => p.id);
  if (ids.length === 0) return [];
  const { data, error } = await supabase
    .from("leads")
    .select("*")
    .in("project_id", ids)
    .order("created_at", { ascending: false });
  if (error) { console.error("getLeads:", error.message); return []; }
  return data as Lead[];
}

export async function updateLeadStatus(leadId: string, status: LeadStatus): Promise<boolean> {
  const { error } = await (supabase.from("leads") as AnyQuery)
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", leadId);
  if (error) { console.error("updateLeadStatus:", error.message); return false; }
  return true;
}

// ── Builder profile ───────────────────────────────────────────────────────────

export async function getBuilderProfile(): Promise<{
  company_slug: string;
  company_name: string;
  logo_url: string | null;
  contact_email: string | null;
} | null> {
  try {
    if (typeof window !== "undefined") {
      const impersonateId = window.localStorage.getItem(IMPERSONATE_KEY);
      if (impersonateId) {
        const { data } = await (supabase as AnyQuery)
          .from("builders").select("company_slug,company_name,logo_url,contact_email").eq("id", impersonateId).single();
        if (data) return data;
      }
    }
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    const { data: profile } = await (supabase as AnyQuery)
      .from("profiles").select("builder_id").eq("id", user.id).single();
    if (!profile?.builder_id) return null;
    const { data: builder } = await (supabase as AnyQuery)
      .from("builders").select("company_slug,company_name,logo_url,contact_email").eq("id", profile.builder_id).single();
    return builder ?? null;
  } catch { return null; }
}

// ── Communities ───────────────────────────────────────────────────────────────

interface CommunityStats {
  id: string; name: string; slug: string; description: string | null;
  site_map_url: string | null; company_slug: string | null;
  created_at: string; updated_at: string;
  lot_count: number; available: number; reserved: number; sold: number;
}

export async function getBuilderCommunities(): Promise<CommunityStats[]> {
  const slug = await getBuilderCompanySlug();
  if (!slug) return [];
  const { data, error } = await (supabase as AnyQuery)
    .from("communities")
    .select("*, lots(id, status)")
    .eq("company_slug", slug)
    .order("created_at", { ascending: false });
  if (error) { console.error("getBuilderCommunities:", error.message); return []; }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data ?? []).map((c: any) => ({
    ...c,
    lot_count: c.lots?.length ?? 0,
    available: c.lots?.filter((l: { status: string }) => l.status === "available").length ?? 0,
    reserved:  c.lots?.filter((l: { status: string }) => l.status === "reserved").length ?? 0,
    sold:      c.lots?.filter((l: { status: string }) => l.status === "sold").length ?? 0,
  }));
}

export async function updateLeadNotes(leadId: string, notes: string): Promise<boolean> {
  const { error } = await (supabase.from("leads") as AnyQuery)
    .update({ notes, updated_at: new Date().toISOString() })
    .eq("id", leadId);
  if (error) { console.error("updateLeadNotes:", error.message); return false; }
  return true;
}

// ── Builder ID helper ─────────────────────────────────────────────────────────

async function getBuilderId(): Promise<string | null> {
  try {
    if (typeof window !== "undefined") {
      const impersonateId = window.localStorage.getItem(IMPERSONATE_KEY);
      if (impersonateId) return impersonateId;
    }
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    const { data: profile } = await (supabase as AnyQuery)
      .from("profiles").select("builder_id").eq("id", user.id).single();
    return profile?.builder_id ?? null;
  } catch { return null; }
}

// ── Render Requests ───────────────────────────────────────────────────────────

export type NewRenderRequest = Pick<RenderRequest,
  "project_id" | "type" | "configuration_notes" | "reference_files" | "priority"
> & { title?: string | null };

export async function getRenderRequests(): Promise<RenderRequest[]> {
  const builderId = await getBuilderId();
  if (!builderId) return [];
  const { data, error } = await (supabase.from("render_requests") as AnyQuery)
    .select("*")
    .eq("builder_id", builderId)
    .order("created_at", { ascending: false });
  if (error) { console.error("getRenderRequests:", error.message); return []; }
  return data as RenderRequest[];
}

export async function createRenderRequest(req: NewRenderRequest): Promise<RenderRequest | null> {
  const builderId = await getBuilderId();
  if (!builderId) return null;
  const creditsUsed = req.priority === "rush" ? 2 : 1;
  const { data, error } = await (supabase.from("render_requests") as AnyQuery)
    .insert({
      ...req,
      builder_id:   builderId,
      credits_used: creditsUsed,
      status:       "submitted",
    })
    .select()
    .single();
  if (error) { console.error("createRenderRequest:", error.message); return null; }
  return data as RenderRequest;
}

export async function requestRenderRevision(id: string, revisionNotes: string): Promise<boolean> {
  const { error } = await (supabase.from("render_requests") as AnyQuery)
    .update({ status: "revision_requested", revision_notes: revisionNotes })
    .eq("id", id);
  if (error) { console.error("requestRenderRevision:", error.message); return false; }
  return true;
}

export async function getBuilderSubscription(): Promise<{
  builder: Pick<Builder, "id" | "company_name" | "plan_tier" | "plan_id" | "stripe_subscription_status" | "current_period_end" | "billing_cycle" | "rendering_credits" | "rendering_credits_total" | "max_projects" | "seats_included" | "seats_used"> & { ai_credits_remaining: number; ai_credits_total: number };
  plan: Plan | null;
} | null> {
  const builderId = await getBuilderId();
  if (!builderId) return null;
  const { data: builder, error } = await (supabase as AnyQuery)
    .from("builders")
    .select("id, company_name, plan_tier, plan_id, stripe_subscription_status, current_period_end, billing_cycle, rendering_credits, rendering_credits_total, max_projects, seats_included, seats_used, ai_credits_remaining, ai_credits_total")
    .eq("id", builderId)
    .single();
  if (error || !builder) return null;
  let plan: Plan | null = null;
  if (builder.plan_id) {
    const { data: p } = await (supabase as AnyQuery).from("plans").select("*").eq("id", builder.plan_id).single();
    plan = p ?? null;
  }
  return { builder, plan };
}

export async function getAllPlans(): Promise<Plan[]> {
  const { data, error } = await supabase.from("plans").select("*").eq("is_active", true).order("sort_order");
  if (error) { console.error("getAllPlans:", error.message); return []; }
  return data as Plan[];
}

export async function getBuilderCredits(): Promise<{ used: number; total: number } | null> {
  const builderId = await getBuilderId();
  if (!builderId) return null;
  const { data, error } = await (supabase as AnyQuery)
    .from("builders")
    .select("rendering_credits, rendering_credits_total")
    .eq("id", builderId)
    .single();
  if (error) { console.error("getBuilderCredits:", error.message); return null; }
  return {
    used:  (data.rendering_credits_total ?? 0) - (data.rendering_credits ?? 0),
    total: data.rendering_credits_total ?? 0,
  };
}

// ── Render Request Detail + Chat ──────────────────────────────────────────────

export async function getRenderRequestById(id: string): Promise<RenderRequest | null> {
  const { data, error } = await (supabase.from("render_requests") as AnyQuery)
    .select("*").eq("id", id).single();
  if (error) { console.error("getRenderRequestById:", error.message); return null; }
  return data as RenderRequest;
}

export async function getRenderMessages(requestId: string): Promise<RenderMessage[]> {
  const res = await fetch(`/api/render-messages/${requestId}`);
  if (!res.ok) return [];
  return res.json();
}

export async function sendBuilderMessage(
  requestId: string,
  body: string | null,
  attachments: RenderMessageAttachment[],
): Promise<RenderMessage | null> {
  const builderId = await getBuilderId();
  // Get sender name from profile
  const { data: { user } } = await supabase.auth.getUser();
  let senderName = "Builder";
  if (user) {
    const { data: profile } = await (supabase as AnyQuery)
      .from("profiles").select("full_name").eq("id", user.id).single();
    senderName = profile?.full_name ?? senderName;
  }
  const res = await fetch(`/api/render-messages/${requestId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      sender_type: "builder",
      sender_id:   builderId ?? user?.id ?? "unknown",
      sender_name: senderName,
      body,
      attachments,
      is_delivery: false,
    }),
  });
  if (!res.ok) return null;
  return res.json();
}

export async function respondToCompletionDate(
  requestId: string,
  accept: boolean,
): Promise<boolean> {
  const res = await fetch(`/api/render-requests/${requestId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      completion_date_status: accept ? "accepted" : "declined",
    }),
  });
  return res.ok;
}

export async function proposeCounterDate(requestId: string, date: string): Promise<boolean> {
  const res = await fetch(`/api/render-requests/${requestId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ proposed_completion_date: date, completion_date_status: "counter_proposed" }),
  });
  return res.ok;
}
