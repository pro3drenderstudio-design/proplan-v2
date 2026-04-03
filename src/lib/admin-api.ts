import { supabase } from "@/lib/supabase";
import { Project, CategoryWithOptions, PhaseColumn, ProjectRequest, Lead, Builder, TeamMember, TeamRole, SupportTicket, TicketStatus, Community, Lot, CommunityWithLots } from "@/types/database";
import { CameraCoords } from "@/utils/sketchfab-camera";

// Supabase @postgrest-js v2 conditional type inference only works with generated types.
// For update/insert operations we cast the query builder to `any` to bypass
// the deferred conditional `Row extends (Relation extends { Update } ? Relation['Update'] : never)`.
type AnyQuery = any; // eslint-disable-line @typescript-eslint/no-explicit-any

export async function getAllProjects(): Promise<Project[]> {
  const { data, error } = await supabase
    .from("projects")
    .select("*")
    .order("name");
  if (error) { console.error("getAllProjects:", error.message); return []; }
  return data as Project[];
}

export async function getCategoriesWithOptions(projectId: string): Promise<CategoryWithOptions[]> {
  const { data, error } = await supabase
    .from("categories")
    .select("*, options(id, friendly_name, node_list, node_conditions, price_impact, sort_order)")
    .eq("project_id", projectId)
    .order("sort_order")
    .order("sort_order", { referencedTable: "options" });
  if (error) { console.error("getCategoriesWithOptions:", error.message); return []; }
  return data as CategoryWithOptions[];
}

export async function saveOptionMapping(
  optionId: string,
  nodeList: string[],
  nodeConditions: Record<string, string>
): Promise<boolean> {
  const { data, error } = await (supabase.from("options") as AnyQuery)
    .update({ node_list: nodeList, node_conditions: nodeConditions })
    .eq("id", optionId)
    .select("id");
  if (error) { console.error("saveOptionMapping:", error.message); return false; }
  if (!data || data.length === 0) { console.error("saveOptionMapping: no rows updated — check RLS"); return false; }
  return true;
}

export async function savePhaseCamera(
  projectId: string,
  phase: PhaseColumn,
  coords: CameraCoords
): Promise<boolean> {
  const { data: existing, error: fetchErr } = await supabase
    .from("projects")
    .select("*")
    .eq("id", projectId)
    .single();
  if (fetchErr || !existing) { console.error("savePhaseCamera fetch:", fetchErr?.message); return false; }

  const proj = existing as unknown as { camera_defaults: Record<string, unknown> | null };
  const updated = { ...(proj.camera_defaults ?? {}), [phase]: coords };
  const { data, error } = await (supabase.from("projects") as AnyQuery)
    .update({ camera_defaults: updated })
    .eq("id", projectId)
    .select("id");
  if (error) { console.error("savePhaseCamera update:", error.message); return false; }
  if (!data || data.length === 0) { console.error("savePhaseCamera: no rows updated — check RLS"); return false; }
  return true;
}

export async function saveCategoryCamera(
  categoryId: string,
  coords: CameraCoords
): Promise<boolean> {
  const { data, error } = await (supabase.from("categories") as AnyQuery)
    .update({ camera_override: coords })
    .eq("id", categoryId)
    .select("id");
  if (error) { console.error("saveCategoryCamera:", error.message); return false; }
  if (!data || data.length === 0) { console.error("saveCategoryCamera: no rows updated — check RLS"); return false; }
  return true;
}

// ── Overview stats ────────────────────────────────────────────────────────────

export interface AdminStats {
  totalProjects:  number;
  liveProjects:   number;
  totalLeads:     number;
  newLeads:       number;
  convertedLeads: number;
  totalQuoteValue: number;
  pendingRequests: number;
  totalRequests:  number;
}

export async function getAdminStats(): Promise<AdminStats> {
  const [projRes, leadsRes] = await Promise.all([
    supabase.from("projects").select("status"),
    supabase.from("leads").select("status, total_value"),
  ]);
  const projects = (projRes.data  ?? []) as { status: string }[];
  const leads    = (leadsRes.data ?? []) as { status: string; total_value: number }[];

  return {
    totalProjects:   projects.length,
    liveProjects:    projects.filter(p => p.status === "live").length,
    totalLeads:      leads.length,
    newLeads:        leads.filter(l => l.status === "new").length,
    convertedLeads:  leads.filter(l => l.status === "converted").length,
    totalQuoteValue: leads.reduce((s, l) => s + (l.total_value ?? 0), 0),
    pendingRequests: projects.filter(p => p.status === "pending_review").length,
    totalRequests:   projects.length,
  };
}

// ── Project requests ───────────────────────────────────────────────────────────

export async function getAllProjectRequests(): Promise<ProjectRequest[]> {
  const { data, error } = await supabase
    .from("project_requests")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) { console.error("getAllProjectRequests:", error.message); return []; }
  return data as ProjectRequest[];
}

export async function updateProjectRequestStatus(
  id: string,
  status: ProjectRequest["status"],
): Promise<boolean> {
  const { error } = await (supabase.from("project_requests") as AnyQuery)
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) { console.error("updateProjectRequestStatus:", error.message); return false; }
  return true;
}

// ── Cross-platform leads ──────────────────────────────────────────────────────

export async function getAllLeads(): Promise<Lead[]> {
  const { data, error } = await supabase
    .from("leads")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) { console.error("getAllLeads:", error.message); return []; }
  return data as Lead[];
}

// ── Builders ──────────────────────────────────────────────────────────────────

export async function getAllBuilders(): Promise<Builder[]> {
  const { data, error } = await supabase
    .from("builders")
    .select("*")
    .order("company_name");
  if (error) { console.error("getAllBuilders:", error.message); return []; }
  return data as Builder[];
}

export async function updateProjectStatus(
  id: string,
  status: NonNullable<Project["status"]>
): Promise<boolean> {
  const { error } = await (supabase.from("projects") as AnyQuery)
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) { console.error("updateProjectStatus:", error.message); return false; }
  return true;
}

export async function updateProject(
  id: string,
  payload: Partial<Pick<Project, "name" | "slug" | "sketchfab_uid" | "home_type" | "description" | "beds" | "baths" | "floors" | "sqft" | "base_price" | "thumbnail_url">>
): Promise<boolean> {
  const { error } = await (supabase.from("projects") as AnyQuery)
    .update({ ...payload, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) { console.error("updateProject:", error.message); return false; }
  return true;
}

export async function getBuilderByCompanySlug(slug: string): Promise<Builder | null> {
  const { data, error } = await supabase
    .from("builders")
    .select("*")
    .eq("company_slug", slug)
    .single();
  if (error) { return null; }
  return data as Builder;
}

export async function getAllBuildersBySlug(): Promise<Record<string, Builder>> {
  const { data, error } = await supabase.from("builders").select("*");
  if (error || !data) return {};
  const map: Record<string, Builder> = {};
  for (const b of data as Builder[]) map[b.company_slug] = b;
  return map;
}

export async function getBuilderById(id: string): Promise<Builder | null> {
  const { data, error } = await supabase
    .from("builders")
    .select("*")
    .eq("id", id)
    .single();
  if (error) { console.error("getBuilderById:", error.message); return null; }
  return data as Builder;
}

export async function createBuilder(
  payload: Omit<Builder, "id" | "created_at" | "updated_at">
): Promise<Builder | null> {
  const { data, error } = await (supabase.from("builders") as AnyQuery)
    .insert(payload)
    .select()
    .single();
  if (error) { console.error("createBuilder:", error.message); return null; }
  return data as Builder;
}

export async function updateBuilder(
  id: string,
  payload: Partial<Omit<Builder, "id" | "created_at">>
): Promise<boolean> {
  const { error } = await (supabase.from("builders") as AnyQuery)
    .update({ ...payload, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) { console.error("updateBuilder:", error.message); return false; }
  return true;
}

export async function getBuilderProjects(companySlug: string): Promise<Project[]> {
  const { data, error } = await supabase
    .from("projects")
    .select("*")
    .eq("company_slug", companySlug)
    .order("created_at", { ascending: false });
  if (error) { console.error("getBuilderProjects:", error.message); return []; }
  return data as Project[];
}

export async function getBuilderLeads(projectIds: string[]): Promise<Lead[]> {
  if (projectIds.length === 0) return [];
  const { data, error } = await supabase
    .from("leads")
    .select("*")
    .in("project_id", projectIds)
    .order("created_at", { ascending: false });
  if (error) { console.error("getBuilderLeads:", error.message); return []; }
  return data as Lead[];
}

// ── Team Members ──────────────────────────────────────────────────────────────

export async function getAllTeamMembers(): Promise<TeamMember[]> {
  const { data, error } = await supabase
    .from("team_members")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) { console.error("getAllTeamMembers:", error.message); return []; }
  return data as TeamMember[];
}

export async function createTeamMember(
  payload: { name: string; email: string; role: TeamRole; permissions?: Record<string, boolean>; builder_id?: string | null }
): Promise<TeamMember | null> {
  const token = crypto.randomUUID();
  const { data, error } = await (supabase.from("team_members") as AnyQuery)
    .insert({
      ...payload,
      permissions: payload.permissions ?? {},
      invite_token: token,
      invite_status: "pending",
    })
    .select()
    .single();
  if (error) { console.error("createTeamMember:", error.message); return null; }
  return data as TeamMember;
}

export async function resendInvite(memberId: string): Promise<TeamMember | null> {
  const token = crypto.randomUUID();
  const { data, error } = await (supabase.from("team_members") as AnyQuery)
    .update({ invite_token: token, invite_sent_at: new Date().toISOString() })
    .eq("id", memberId)
    .select()
    .single();
  if (error) { console.error("resendInvite:", error.message); return null; }
  return data as TeamMember;
}

export async function updateTeamMember(
  id: string,
  payload: Partial<Pick<TeamMember, "role" | "permissions" | "name">>
): Promise<boolean> {
  const { error } = await (supabase.from("team_members") as AnyQuery)
    .update(payload)
    .eq("id", id);
  if (error) { console.error("updateTeamMember:", error.message); return false; }
  return true;
}

export async function deleteTeamMember(id: string): Promise<boolean> {
  const { error } = await (supabase.from("team_members") as AnyQuery)
    .delete()
    .eq("id", id);
  if (error) { console.error("deleteTeamMember:", error.message); return false; }
  return true;
}

// ── Support Tickets ───────────────────────────────────────────────────────────

export async function getSupportTickets(): Promise<SupportTicket[]> {
  const { data, error } = await supabase
    .from("support_tickets")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) { console.error("getSupportTickets:", error.message); return []; }
  return (data ?? []) as SupportTicket[];
}

export async function updateSupportTicket(
  id: string,
  payload: Partial<Pick<SupportTicket, "status" | "assigned_to" | "admin_notes">>
): Promise<boolean> {
  const { error } = await (supabase.from("support_tickets") as AnyQuery)
    .update({ ...payload, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) { console.error("updateSupportTicket:", error.message); return false; }
  return true;
}

export async function setDefaultOption(
  categoryId: string,
  optionFriendlyName: string
): Promise<boolean> {
  const { data, error } = await (supabase.from("categories") as AnyQuery)
    .update({ default_option: optionFriendlyName })
    .eq("id", categoryId)
    .select("id");
  if (error) { console.error("setDefaultOption:", error.message); return false; }
  if (!data || data.length === 0) { console.error("setDefaultOption: no rows updated — check RLS"); return false; }
  return true;
}

// ── Communities ───────────────────────────────────────────────────────────────

export async function getAllCommunities(): Promise<(Community & { lot_count: number })[]> {
  const { data, error } = await supabase.from("communities").select("*, lots(id)").order("name");
  if (error) { console.error("getAllCommunities:", error.message); return []; }
  return (data ?? []).map((c: Community & { lots: { id: string }[] }) => ({
    ...c,
    lot_count: c.lots?.length ?? 0,
  }));
}

export async function getCommunityById(id: string): Promise<CommunityWithLots | null> {
  const { data, error } = await supabase
    .from("communities")
    .select("*, lots(*)")
    .eq("id", id)
    .single();
  if (error) { console.error("getCommunityById:", error.message); return null; }
  return data as CommunityWithLots;
}

export async function getCommunityBySlug(companySlug: string, slug: string): Promise<CommunityWithLots | null> {
  const { data, error } = await supabase
    .from("communities")
    .select("*, lots(*)")
    .eq("company_slug", companySlug)
    .eq("slug", slug)
    .single();
  if (error) { return null; }
  return data as CommunityWithLots;
}

export async function createCommunity(
  payload: Pick<Community, "company_slug" | "name" | "slug"> & Partial<Pick<Community, "description">>
): Promise<Community | null> {
  const { data, error } = await (supabase.from("communities") as AnyQuery)
    .insert(payload).select().single();
  if (error) { console.error("createCommunity:", error.message); return null; }
  return data as Community;
}

export async function updateCommunity(
  id: string,
  payload: Partial<Pick<Community, "name" | "slug" | "description" | "site_map_url">>
): Promise<boolean> {
  const { error } = await (supabase.from("communities") as AnyQuery)
    .update({ ...payload, updated_at: new Date().toISOString() }).eq("id", id);
  if (error) { console.error("updateCommunity:", error.message); return false; }
  return true;
}

// ── Lots ──────────────────────────────────────────────────────────────────────

export async function createLot(
  payload: Pick<Lot, "community_id" | "lot_number" | "polygon"> & Partial<Pick<Lot, "status" | "project_id" | "price_modifier" | "notes">>
): Promise<Lot | null> {
  const { data, error } = await (supabase.from("lots") as AnyQuery)
    .insert({ status: "available", price_modifier: 0, ...payload }).select().single();
  if (error) { console.error("createLot:", error.message); return null; }
  return data as Lot;
}

export async function updateLot(
  id: string,
  payload: Partial<Pick<Lot, "lot_number" | "status" | "project_id" | "polygon" | "price_modifier" | "notes">>
): Promise<boolean> {
  const { error } = await (supabase.from("lots") as AnyQuery)
    .update({ ...payload, updated_at: new Date().toISOString() }).eq("id", id);
  if (error) { console.error("updateLot:", error.message); return false; }
  return true;
}

export async function deleteLot(id: string): Promise<boolean> {
  const { error } = await (supabase.from("lots") as AnyQuery).delete().eq("id", id);
  if (error) { console.error("deleteLot:", error.message); return false; }
  return true;
}
