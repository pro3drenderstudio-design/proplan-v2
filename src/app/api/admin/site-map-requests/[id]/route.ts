import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { notifySiteMapComplete } from "@/lib/notify";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json() as { status?: string; admin_notes?: string; community_id?: string };

  const update: Record<string, string> = {};
  if (body.status)       update.status       = body.status;
  if (body.admin_notes !== undefined) update.admin_notes = body.admin_notes;
  if (body.community_id) update.community_id = body.community_id;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.from("site_map_requests") as any)
    .update(update)
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Notify builder on completion
  if (body.status === "complete") {
    notifySiteMapComplete(id).catch(err => console.error("notifySiteMapComplete:", err));
  }

  return NextResponse.json({ ok: true });
}
