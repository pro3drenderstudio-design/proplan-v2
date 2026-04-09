import { Inngest } from "inngest";

export const inngest = new Inngest({
  id: "proplan-studio",
  name: "ProPlan Studio",
});

// ─── Event Types ──────────────────────────────────────────────────────────────
export type OutreachSendTrigger  = { name: "outreach/send.trigger";  data: Record<string, never> };
export type OutreachReplyTrigger = { name: "outreach/reply-poll.trigger"; data: Record<string, never> };
export type OutreachWarmupTrigger = { name: "outreach/warmup-ramp.trigger"; data: Record<string, never> };

export type InngestEvents =
  | OutreachSendTrigger
  | OutreachReplyTrigger
  | OutreachWarmupTrigger;
