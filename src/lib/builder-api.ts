import { supabase } from "@/lib/supabase";
import {
  Project, ProjectRequest, Lead, LeadStatus,
  Category, Option, CategoryWithOptions, ProjectFile,
} from "@/types/database";

export type { ProjectRequest, Lead, LeadStatus };

export type NewProjectRequest = Omit<ProjectRequest, "id" | "status" | "created_at" | "updated_at">;

// Supabase @postgrest-js v2 conditional type inference only works with generated types.
// For insert/update operations we cast the query builder to `any`.
type AnyQuery = any; // eslint-disable-line @typescript-eslint/no-explicit-any

// ── Project Requests ──────────────────────────────────────────────────────────

export async function getProjectRequests(): Promise<ProjectRequest[]> {
  const { data, error } = await supabase
    .from("project_requests")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) { console.error("getProjectRequests:", error.message); return []; }
  return data as ProjectRequest[];
}

export async function createProjectRequest(req: NewProjectRequest): Promise<ProjectRequest | null> {
  const { data, error } = await (supabase.from("project_requests") as AnyQuery)
    .insert(req)
    .select()
    .single();
  if (error) { console.error("createProjectRequest:", error.message); return null; }

  // Mirror to projects table via service-role API route (bypasses RLS)
  try {
    const companySlug = await getBuilderCompanySlug();
    await fetch("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name:          req.project_name,
        company_slug:  companySlug,
        home_type:     req.home_type,
        floors:        req.floors,
        beds:          req.beds,
        baths:         req.baths,
        sqft:          req.square_footage,
        base_price:    req.starting_price ?? 0,
        description:   req.description,
        status:        "pending_review",
      }),
    });
  } catch (e) {
    console.warn("createProjectRequest: could not mirror to projects table:", e);
  }

  return data as ProjectRequest;
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
