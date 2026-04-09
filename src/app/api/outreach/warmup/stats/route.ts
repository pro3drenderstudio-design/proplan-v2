import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { WarmupPoolStats } from "@/types/outreach";

function supabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

export async function GET() {
  const db = supabase();
  const now = new Date();

  const todayStart = new Date(now);
  todayStart.setUTCHours(0, 0, 0, 0);

  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const [
    { count: poolSize },
    { count: sentToday },
    { count: rescued7d },
    { data: recentSends },
  ] = await Promise.all([
    db.from("outreach_inboxes").select("*", { count: "exact", head: true })
      .eq("status", "active").eq("warmup_enabled", true),
    db.from("outreach_warmup_sends").select("*", { count: "exact", head: true })
      .gte("sent_at", todayStart.toISOString()),
    db.from("outreach_warmup_sends").select("*", { count: "exact", head: true })
      .gte("sent_at", sevenDaysAgo.toISOString())
      .eq("rescued_from_spam", true),
    db.from("outreach_warmup_sends")
      .select("replied_at")
      .gte("sent_at", sevenDaysAgo.toISOString()),
  ]);

  const total7d   = recentSends?.length ?? 0;
  const replied7d = recentSends?.filter((r) => r.replied_at).length ?? 0;
  const replyRate = total7d > 0 ? replied7d / total7d : 0;

  const stats: WarmupPoolStats = {
    pool_size:              poolSize ?? 0,
    sent_today:             sentToday ?? 0,
    rescued_from_spam_7d:   rescued7d ?? 0,
    reply_rate_7d:          replyRate,
  };

  return NextResponse.json(stats);
}
