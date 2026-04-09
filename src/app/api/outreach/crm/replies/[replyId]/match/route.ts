import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { markEnrollmentReplied } from "@/lib/outreach/scheduler";

function supabase() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

/** Manually match an unmatched reply to a specific enrollment. */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ replyId: string }> },
) {
  const { replyId } = await params;
  const { enrollment_id } = await req.json();

  if (!enrollment_id)
    return NextResponse.json({ error: "enrollment_id required" }, { status: 400 });

  const db = supabase();

  // Find the latest sent send for this enrollment (to associate with)
  const { data: send } = await db
    .from("outreach_sends")
    .select("id")
    .eq("enrollment_id", enrollment_id)
    .eq("status", "sent")
    .order("sent_at", { ascending: false })
    .limit(1)
    .single();

  // Update the reply record
  await db.from("outreach_replies").update({
    enrollment_id,
    send_id: send?.id ?? null,
  }).eq("id", replyId);

  // Mark the enrollment as replied
  if (send) {
    await markEnrollmentReplied(enrollment_id, send.id);
  } else {
    await db.from("outreach_enrollments")
      .update({ status: "replied" })
      .eq("id", enrollment_id);
  }

  return NextResponse.json({ ok: true });
}
