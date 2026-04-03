import { createClient } from "@supabase/supabase-js";
import { Database, VariableMapEntry, Project, CategoryWithOptions, ProjectGeometryRule } from "@/types/database";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Missing Supabase environment variables. " +
    "Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local"
  );
}

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey);

// Fetch a builder by company slug (for configurator / quote branding)
export async function getBuilderBySlug(companySlug: string) {
  const { data } = await supabase
    .from("builders")
    .select("id,company_name,logo_url,accent_color,contact_email,phone,billing_address,city,state,zip,website_url")
    .eq("company_slug", companySlug)
    .single();
  return data ?? null;
}

// Fetch a single model configuration by its Sketchfab model ID.
// Returns null if not found rather than throwing, so callers can fall back to defaults.
export async function getModelConfiguration(modelId: string) {
  const { data, error } = await supabase
    .from("ModelConfigurations")
    .select("*")
    .eq("model_id", modelId)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null; // row not found — not a real error
    console.error("getModelConfiguration error:", error.message);
    return null;
  }

  return data;
}

// Fetch all variable_map rows, optionally filtered by category.
// Results are ordered by category then by the row's natural insert order.
export async function getVariableMap(category?: string): Promise<VariableMapEntry[]> {
  let query = supabase
    .from("variable_map")
    .select("*")
    .order("category")
    .order("created_at");

  if (category) {
    query = query.eq("category", category);
  }

  const { data, error } = await query;

  if (error) {
    console.error("getVariableMap error:", error.message);
    return [];
  }

  return data ?? [];
}

// Fetch all unique category names from variable_map, sorted alphabetically.
// Useful for building the UI panel tabs/sections.
export async function getVariableCategories(): Promise<string[]> {
  const { data, error } = await supabase
    .from("variable_map")
    .select("*");

  if (error) {
    console.error("getVariableCategories error:", error.message);
    return [];
  }

  const unique = [...new Set((data ?? []).map((r) => (r as unknown as { category: string }).category))].sort();
  return unique;
}

// ---------------------------------------------------------------------------
// projects
// ---------------------------------------------------------------------------

// Fetch all projects (for a listing / selector page).
export async function getProjects(): Promise<Project[]> {
  const { data, error } = await supabase
    .from("projects")
    .select("*")
    .order("name");

  if (error) {
    console.error("getProjects error:", error.message);
    return [];
  }

  return data ?? [];
}

// Fetch a project by company_slug + slug (used by the configurator dynamic route).
export async function getProjectBySlugs(companySlug: string, projectSlug: string): Promise<Project | null> {
  const { data, error } = await supabase
    .from("projects")
    .select("*")
    .eq("company_slug", companySlug)
    .eq("slug", projectSlug)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null;
    console.error("getProjectBySlugs error:", error.message);
    return null;
  }

  return data;
}

// Fetch a single project by its Sketchfab UID.
export async function getProjectBySketchfabUid(uid: string): Promise<Project | null> {
  const { data, error } = await supabase
    .from("projects")
    .select("*")
    .eq("sketchfab_uid", uid)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null;
    console.error("getProjectBySketchfabUid error:", error.message);
    return null;
  }

  return data;
}

// ---------------------------------------------------------------------------
// categories + options
// ---------------------------------------------------------------------------

// Fetch all categories for a project, with their options nested inside.
// Optionally filter to a single phase so you only load what the current view needs.
export async function getCategoriesWithOptions(
  projectId: string,
  phase?: "blueprint" | "interior" | "exterior"
): Promise<CategoryWithOptions[]> {
  let query = supabase
    .from("categories")
    .select("*, options(*)")
    .eq("project_id", projectId)
    .order("sort_order")
    .order("sort_order", { referencedTable: "options" });

  if (phase) {
    query = query.eq("phase", phase);
  }

  const { data, error } = await query;

  if (error) {
    console.error("getCategoriesWithOptions error:", error.message);
    return [];
  }

  return (data ?? []) as CategoryWithOptions[];
}

// ---------------------------------------------------------------------------
// geometry_rules
// ---------------------------------------------------------------------------

// Fetch all geometry rules for a project.
// Pass these directly into ruleProcessor.processRules().
export async function getGeometryRules(projectId: string): Promise<ProjectGeometryRule[]> {
  const { data, error } = await supabase
    .from("geometry_rules")
    .select("*")
    .eq("project_id", projectId);

  if (error) {
    console.error("getGeometryRules error:", error.message);
    return [];
  }

  return data ?? [];
}
