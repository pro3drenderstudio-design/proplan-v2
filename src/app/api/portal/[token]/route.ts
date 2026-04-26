/**
 * GET /api/portal/[token] — fetch a saved configuration with project + category data
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function supabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const db = supabase();

  // Fetch saved configuration
  const { data: saved, error: savedErr } = await db
    .from("saved_configurations")
    .select("*")
    .eq("token", token)
    .single();

  if (savedErr || !saved) {
    return NextResponse.json({ error: "Configuration not found" }, { status: 404 });
  }

  // Stamp accessed_at once
  db.from("saved_configurations")
    .update({ accessed_at: new Date().toISOString() })
    .eq("token", token)
    .then(() => {});

  // Fetch project
  const { data: project, error: projectErr } = await db
    .from("projects")
    .select("*")
    .eq("id", saved.project_id)
    .single();

  if (projectErr || !project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  // Fetch categories + options
  const { data: categories } = await db
    .from("categories")
    .select("*, options(*)")
    .eq("project_id", saved.project_id)
    .order("sort_order")
    .order("sort_order", { referencedTable: "options" });

  // Fetch materials (only needed for R3F projects with material_override options)
  const { data: materials } = await db
    .from("material_library")
    .select("*")
    .order("name");

  // Fetch builder branding (via project's company_slug)
  let builder = null;
  if (project.company_slug) {
    const { data: builderData } = await db
      .from("builders")
      .select("company_name, logo_url, accent_color, contact_email, phone")
      .eq("slug", project.company_slug)
      .single();
    builder = builderData ?? null;
  }

  return NextResponse.json({
    saved,
    project,
    categories: categories ?? [],
    materials:  materials  ?? [],
    builder,
  });
}
