import { NextResponse } from "next/server";
import { runSendBatch } from "@/lib/outreach/send-runner";
import { runReplyPoll } from "@/lib/outreach/reply-runner";

export const maxDuration = 300;

export async function POST() {
  const [sendResult, replyResult] = await Promise.all([
    runSendBatch(20, 2_000, 5_000),
    runReplyPoll(),
  ]);
  return NextResponse.json({ sends: sendResult, replies: replyResult });
}
