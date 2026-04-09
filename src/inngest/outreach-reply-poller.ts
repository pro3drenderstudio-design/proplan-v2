import { inngest } from "@/lib/inngest";
import { runReplyPoll } from "@/lib/outreach/reply-runner";

export const outreachReplyPoller = inngest.createFunction(
  { id: "outreach-reply-poller", name: "Outreach: Poll for Replies", triggers: [{ event: "outreach/reply-poll.trigger" as const }] },
  async ({ step }) => {
    const result = await step.run("poll-replies", () => runReplyPoll());
    return result;
  },
);
