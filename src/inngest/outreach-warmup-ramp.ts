import { createClient } from "@supabase/supabase-js";
import { inngest } from "@/lib/inngest";

function supabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

/** Runs weekly to ramp up the warmup send volume for each inbox. */
export const outreachWarmupRamp = inngest.createFunction(
  { id: "outreach-warmup-ramp", name: "Outreach: Weekly Warmup Ramp", triggers: [{ cron: "0 0 * * 1" }] },
  async ({ step }) => {
    const db = supabase();

    const { data: inboxes } = await db
      .from("outreach_inboxes")
      .select("id, warmup_enabled, warmup_current_daily, warmup_target_daily, warmup_ramp_per_week, daily_send_limit")
      .eq("warmup_enabled", true)
      .eq("status", "active");

    if (!inboxes?.length) return;

    await Promise.all(
      inboxes.map((inbox) =>
        step.run(`ramp-inbox-${inbox.id}`, async () => {
          const newDaily = Math.min(
            inbox.warmup_current_daily + inbox.warmup_ramp_per_week,
            inbox.warmup_target_daily,
          );

          // When warmup reaches target, also raise the daily_send_limit if it's lower
          const newLimit = Math.max(inbox.daily_send_limit, newDaily);

          await db
            .from("outreach_inboxes")
            .update({
              warmup_current_daily: newDaily,
              daily_send_limit:     newLimit,
            })
            .eq("id", inbox.id);

          return { inboxId: inbox.id, from: inbox.warmup_current_daily, to: newDaily };
        }),
      ),
    );
  },
);
