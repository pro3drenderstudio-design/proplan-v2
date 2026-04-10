import { NextRequest, NextResponse } from "next/server";
import { runWarmupBatch } from "@/lib/outreach/warmup-runner";

/**
 * Manual trigger for warmup pool sends.
 * Use this to send warmup emails on-demand instead of waiting for the cron.
 */
export async function POST(req: NextRequest) {
  // Optional: check for cron secret if configured
  if (process.env.CRON_SECRET) {
    const secret = req.headers.get("authorization")?.replace("Bearer ", "");
    if (secret !== process.env.CRON_SECRET) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const result = await runWarmupBatch();

  return NextResponse.json({
    message: "Warmup send batch completed",
    ...result,
  });
}

// Also allow GET to trigger (for browser/curl convenience)
export async function GET() {
  return POST({ json: async () => ({}) } as NextRequest);
}
