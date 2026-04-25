import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: sourceId } = await params;

  // ── 1. Fetch source project ──────────────────────────────────────────────
  const { data: source, error: fetchErr } = await supabase
    .from("projects")
    .select("*")
    .eq("id", sourceId)
    .single();

  if (fetchErr || !source) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  // ── 2. Insert duplicate project ──────────────────────────────────────────
  const now = new Date().toISOString();
  const slugSuffix = Date.now().toString(36);
  // Strip fields that must be unique or are auto-generated
  const { id: _id, created_at: _c, updated_at: _u, slug, name, views_count, sketchfab_uid: _sfuid, ...projectRest } = source as Record<string, unknown>;

  const { data: newProject, error: projErr } = await supabase
    .from("projects")
    .insert({
      ...projectRest,
      name:          `Copy of ${name}`,
      slug:          slug ? `${slug}-${slugSuffix}` : `project-${slugSuffix}`,
      sketchfab_uid: null,
      views_count:   0,
      status:        "in_development",
      created_at:    now,
      updated_at:    now,
    })
    .select("id")
    .single();

  if (projErr || !newProject) {
    console.error("duplicate project insert:", projErr?.message);
    return NextResponse.json({ error: projErr?.message ?? "Insert failed" }, { status: 500 });
  }

  const newProjectId = (newProject as { id: string }).id;

  // ── 3. Fetch source categories + options ────────────────────────────────
  const { data: cats, error: catsErr } = await supabase
    .from("categories")
    .select("*, options(*)")
    .eq("project_id", sourceId)
    .order("sort_order");

  if (catsErr) {
    console.error("duplicate: fetch categories:", catsErr.message);
    // Project was created — return it even if category copy fails
    return NextResponse.json({ id: newProjectId, warning: "Categories not copied" });
  }

  // ── 4. Copy categories + options ─────────────────────────────────────────
  for (const cat of (cats ?? []) as Array<Record<string, unknown> & { options?: Array<Record<string, unknown>> }>) {
    const { id: catId, created_at: _cc, project_id: _pid, options: catOptions, ...catRest } = cat;

    const { data: newCat, error: catInsertErr } = await supabase
      .from("categories")
      .insert({
        ...catRest,
        project_id:  newProjectId,
        created_at:  now,
      })
      .select("id")
      .single();

    if (catInsertErr || !newCat) {
      console.error("duplicate: category insert:", catInsertErr?.message);
      continue;
    }

    const newCatId = (newCat as { id: string }).id;

    if (!catOptions?.length) continue;

    const optionRows = catOptions.map(({ id: _oid, created_at: _oc, category_id: _ci, ...optRest }) => ({
      ...optRest,
      category_id: newCatId,
      created_at:  now,
    }));

    const { error: optsErr } = await supabase
      .from("options")
      .insert(optionRows);

    if (optsErr) console.error(`duplicate: options for cat ${catId}:`, optsErr.message);
  }

  return NextResponse.json({ id: newProjectId });
}
