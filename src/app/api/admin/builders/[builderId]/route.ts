import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function requireAdmin(): Promise<boolean> {
  const cookieStore = await cookies();
  const authClient = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll() } }
  );
  const { data: { user } } = await authClient.auth.getUser();
  if (!user) return false;
  const { data: profile } = await supabase
    .from("profiles").select("role").eq("id", user.id).single();
  return profile?.role === "admin";
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ builderId: string }> }
) {
  const isAdmin = await requireAdmin();
  if (!isAdmin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { builderId } = await params;

  // Look up the auth user linked to this builder via profiles
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id")
    .eq("builder_id", builderId);

  // Delete the builder row (cascades to: communities, lots, builder_addons,
  // site_map_requests, crm_integrations, render_requests, project_files, leads, quotes)
  const { error } = await supabase
    .from("builders")
    .delete()
    .eq("id", builderId);

  if (error) {
    console.error("DELETE /api/admin/builders/[builderId]:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Delete auth users — best-effort (profile rows cascade on auth user delete)
  if (profiles?.length) {
    for (const p of profiles) {
      await supabase.auth.admin.deleteUser(p.id).catch(err =>
        console.error("deleteUser failed for", p.id, err)
      );
    }
  }

  return NextResponse.json({ ok: true });
}
