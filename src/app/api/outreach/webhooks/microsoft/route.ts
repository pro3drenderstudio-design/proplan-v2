import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { markEnrollmentReplied } from "@/lib/outreach/scheduler";

function supabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

export async function POST(req: NextRequest) {
  // Microsoft Graph sends a validation token on subscription creation
  const validationToken = req.nextUrl.searchParams.get("validationToken");
  if (validationToken) {
    return new NextResponse(validationToken, {
      headers: { "Content-Type": "text/plain" },
    });
  }

  const body = await req.json();
  const notifications = body?.value ?? [];
  const db = supabase();

  for (const notification of notifications) {
    const inboxId        = notification.clientState; // we set clientState = inbox.id
    const resourceData   = notification.resourceData;
    const conversationId = resourceData?.["conversationId"] ?? null;

    if (!inboxId || !conversationId) continue;

    // ── Warmup check: if this thread_id matches a warmup send, skip CRM ──────
    const { data: warmupByThread } = await db
      .from("outreach_warmup_sends")
      .select("id")
      .eq("thread_id", conversationId)
      .limit(1)
      .single();

    if (warmupByThread) {
      await db
        .from("outreach_warmup_sends")
        .update({ replied_at: new Date().toISOString() })
        .eq("id", warmupByThread.id)
        .is("replied_at", null);
      continue;
    }

    // Regular CRM reply
    const { data: send } = await db
      .from("outreach_sends")
      .select("id, enrollment_id")
      .eq("thread_id", conversationId)
      .is("replied_at", null)
      .single();

    if (send) {
      await markEnrollmentReplied(send.enrollment_id, send.id);
    }
  }

  return NextResponse.json({ ok: true });
}
