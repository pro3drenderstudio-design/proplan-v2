import { serve } from "inngest/next";
import { inngest } from "@/lib/inngest";
import { outreachSender } from "@/inngest/outreach-sender";
import { outreachReplyPoller } from "@/inngest/outreach-reply-poller";
import { outreachWarmupRamp } from "@/inngest/outreach-warmup-ramp";
import { outreachWarmupPool } from "@/inngest/outreach-warmup-pool";
import { outreachDailyDigest } from "@/inngest/outreach-daily-digest";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [outreachSender, outreachReplyPoller, outreachWarmupRamp, outreachWarmupPool, outreachDailyDigest],
});
