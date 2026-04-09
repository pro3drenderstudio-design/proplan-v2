import { NextRequest, NextResponse } from "next/server";
import { inngest } from "@/lib/inngest";
import { runSendBatch } from "@/lib/outreach/send-runner";
import { runReplyPoll } from "@/lib/outreach/reply-runner";

export const maxDuration = 300; // Vercel Pro: up to 300s for this route

export async function GET(req: NextRequest) {
  // Only enforce secret if CRON_SECRET is configured
  if (process.env.CRON_SECRET) {
    const secret = req.headers.get("authorization")?.replace("Bearer ", "");
    if (secret !== process.env.CRON_SECRET) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  // ── Run sends + replies directly (works without Inngest) ────────────────
  const [sendResult, replyResult] = await Promise.all([
    runSendBatch(20, 2_000, 5_000),
    runReplyPoll(),
  ]);

  // ── Also fire Inngest events (if configured, handles larger / longer jobs) ─
  let inngestOk = false;
  try {
    await inngest.send([
      { name: "outreach/send.trigger",       data: {} },
      { name: "outreach/reply-poll.trigger", data: {} },
    ]);
    inngestOk = true;
  } catch {
    // Inngest not configured — direct execution above is the fallback
  }

  return NextResponse.json({
    ts:      new Date().toISOString(),
    sends:   sendResult,
    replies: replyResult,
    inngest: inngestOk,
  });
}
