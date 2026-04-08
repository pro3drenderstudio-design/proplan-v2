import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { notifyProjectStatusChange } from "@/lib/notify";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  let updates: Record<string, unknown>;
  try {
    updates = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const newStatus = updates.status as string | undefined;

  // Always stamp updated_at
  updates.updated_at = new Date().toISOString();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.from("projects") as any)
    .update(updates)
    .eq("id", id);

  if (error) {
    console.error("PATCH /api/projects/[id]:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Fire status-change notification (non-blocking)
  if (newStatus) {
    notifyProjectStatusChange(id, newStatus)
      .catch(err => console.error("notifyProjectStatusChange failed:", err));
  }

  return NextResponse.json({ ok: true });
}
