import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { notifyPaymentReminder } from "@/lib/notify";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

// Vercel Cron passes Authorization: Bearer {CRON_SECRET}
function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true; // allow in dev if not set
  const auth = req.headers.get("authorization");
  return auth === `Bearer ${secret}`;
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = Date.now();

  // Fetch all awaiting_payment requests with builder email
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: requests, error } = await (supabase.from("project_requests") as any)
    .select("id, project_name, created_at, payment_reminders_sent, builder_id, builders(contact_email)")
    .eq("status", "awaiting_payment");

  if (error) {
    console.error("cleanup-unpaid-requests fetch:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const results = { reminders_sent: 0, deleted: 0, errors: 0 };

  for (const req of (requests ?? [])) {
    const hoursOld    = (now - new Date(req.created_at).getTime()) / 3_600_000;
    const sent        = req.payment_reminders_sent as number;
    const builderEmail: string = req.builders?.contact_email ?? "";
    const modelName: string    = req.project_name;

    try {
      // Day 4+ — delete if all 3 reminders already sent
      if (hoursOld >= 96 && sent >= 3) {
        // Clean up associated files from DB (storage cleanup is best-effort)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase.from("project_files") as any)
          .delete().eq("request_id", req.id);

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase.from("project_requests") as any)
          .delete().eq("id", req.id);

        results.deleted++;
        continue;
      }

      // Determine which reminder to send based on hours elapsed + how many already sent
      let reminderToSend: number | null = null;
      if (hoursOld >= 24 && sent === 0)       reminderToSend = 1;
      else if (hoursOld >= 48 && sent === 1)  reminderToSend = 2;
      else if (hoursOld >= 72 && sent === 2)  reminderToSend = 3;

      if (reminderToSend !== null) {
        await notifyPaymentReminder(builderEmail, modelName, reminderToSend);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase.from("project_requests") as any)
          .update({ payment_reminders_sent: reminderToSend })
          .eq("id", req.id);
        results.reminders_sent++;
      }
    } catch (e) {
      console.error(`cleanup-unpaid-requests: error on request ${req.id}:`, e);
      results.errors++;
    }
  }

  console.log("cleanup-unpaid-requests:", results);
  return NextResponse.json({ ok: true, ...results });
}
