import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { CrmStatus } from "@/types/outreach";

function supabase() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

const VALID_STATUSES: CrmStatus[] = [
  "neutral", "interested", "meeting_booked", "won", "not_interested", "ooo", "follow_up",
];

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ enrollmentId: string }> },
) {
  const { enrollmentId } = await params;
  const { crm_status } = await req.json();

  if (!VALID_STATUSES.includes(crm_status)) {
    return NextResponse.json({ error: "Invalid crm_status" }, { status: 400 });
  }

  const db = supabase();
  const { error } = await db
    .from("outreach_enrollments")
    .update({ crm_status })
    .eq("id", enrollmentId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
