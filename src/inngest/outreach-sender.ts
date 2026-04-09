import { inngest } from "@/lib/inngest";
import { runSendBatch } from "@/lib/outreach/send-runner";

/**
 * Inngest version of the outreach sender.
 * Uses longer human-like delays (30–120 s) and higher batch limits.
 * Only runs when Inngest is properly configured.
 */
export const outreachSender = inngest.createFunction(
  {
    id:          "outreach-sender",
    name:        "Outreach: Send Due Emails",
    concurrency: { limit: 1 },
    triggers:    [{ event: "outreach/send.trigger" as const }],
  },
  async ({ step }) => {
    const result = await step.run("send-due-emails", async () => {
      // Inngest supports long-running steps — use full human-like delays
      return runSendBatch(100, 30_000, 120_000);
    });

    return result;
  },
);
