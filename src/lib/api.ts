import { supabase } from "@/lib/supabase";
import { CategoryWithOptions, PhaseColumn, Project } from "@/types/database";

const PROJECT_NAME = "The Cypress";

export async function getCypressProject(): Promise<Project | null> {
  const { data, error } = await supabase
    .from("projects")
    .select("*")
    .eq("name", PROJECT_NAME)
    .single();

  if (error || !data) {
    console.error("getCypressProject: fetch failed", error?.message);
    return null;
  }

  return data as Project;
}

export async function getCypressCategories(): Promise<Record<PhaseColumn, CategoryWithOptions[]>> {
  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("*")
    .eq("name", PROJECT_NAME)
    .single();

  if (projectError || !project) {
    console.error("getCypressCategories: project not found", projectError?.message);
    return { blueprint: [], interior: [], exterior: [] };
  }

  const proj = project as unknown as { id: string };
  const { data, error } = await supabase
    .from("categories")
    .select("*, options(id, friendly_name, node_list, node_conditions, price_impact, sort_order)")
    .eq("project_id", proj.id)
    .order("sort_order")
    .order("sort_order", { referencedTable: "options" });

  if (error) {
    console.error("getCypressCategories: fetch failed", error.message);
    return { blueprint: [], interior: [], exterior: [] };
  }

  const grouped: Record<PhaseColumn, CategoryWithOptions[]> = {
    blueprint: [],
    interior:  [],
    exterior:  [],
  };

  for (const cat of (data ?? []) as CategoryWithOptions[]) {
    grouped[cat.phase].push(cat);
  }

  return grouped;
}
