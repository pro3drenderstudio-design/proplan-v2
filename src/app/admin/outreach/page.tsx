import { createClient } from "@supabase/supabase-js";
import Link from "next/link";

async function getStats() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const [
    { count: inboxCount },
    { count: activeCampaigns },
    { count: totalSent },
    { count: totalOpened },
    { count: totalReplied },
    { count: totalLeads },
    { data: recentCampaignRows },
    { data: recentReplies },
  ] = await Promise.all([
    supabase.from("outreach_inboxes").select("id", { count: "exact", head: true }).eq("status", "active"),
    supabase.from("outreach_campaigns").select("id", { count: "exact", head: true }).eq("status", "active"),
    supabase.from("outreach_sends").select("id", { count: "exact", head: true }).eq("status", "sent"),
    supabase.from("outreach_sends").select("id", { count: "exact", head: true }).not("opened_at", "is", null),
    supabase.from("outreach_enrollments").select("id", { count: "exact", head: true }).eq("status", "replied"),
    supabase.from("outreach_leads").select("id", { count: "exact", head: true }).eq("status", "active"),
    supabase.from("outreach_campaigns").select("id, name, status, send_days, send_start_time, send_end_time").in("status", ["active", "paused"]).order("updated_at", { ascending: false }).limit(5),
    supabase.from("outreach_replies")
      .select("id, from_email, from_name, subject, body_text, received_at, ai_category, ai_confidence, enrollment_id, is_filtered")
      .eq("is_filtered", false)
      .order("received_at", { ascending: false })
      .limit(8),
  ]);

  const openRate  = totalSent ? Math.round(((totalOpened  ?? 0) / (totalSent ?? 1)) * 100) : 0;
  const replyRate = totalSent ? Math.round(((totalReplied ?? 0) / (totalSent ?? 1)) * 100) : 0;

  // Attach per-campaign stats for recent campaigns
  const recentCampaigns = await Promise.all(
    (recentCampaignRows ?? []).map(async (c) => {
      const { data: enrollmentData } = await supabase
        .from("outreach_enrollments").select("id, status").eq("campaign_id", c.id);
      const ids = (enrollmentData ?? []).map((e: { id: string }) => e.id);
      const enrolled = enrollmentData?.length ?? 0;
      const replied  = enrollmentData?.filter((e: { status: string }) => e.status === "replied").length ?? 0;

      const [{ count: sent }, { count: opened }] = await Promise.all([
        ids.length
          ? supabase.from("outreach_sends").select("id", { count: "exact", head: true }).eq("status", "sent").in("enrollment_id", ids)
          : Promise.resolve({ count: 0 }),
        ids.length
          ? supabase.from("outreach_sends").select("id", { count: "exact", head: true }).not("opened_at", "is", null).in("enrollment_id", ids)
          : Promise.resolve({ count: 0 }),
      ]);

      const sentN   = sent   ?? 0;
      const openedN = opened ?? 0;
      return {
        ...c,
        enrolled,
        sent: sentN,
        replied,
        open_rate: sentN > 0 ? Math.round((openedN / sentN) * 100) : 0,
        reply_rate: sentN > 0 ? Math.round((replied / sentN) * 100) : 0,
      };
    }),
  );

  return { inboxCount, activeCampaigns, totalSent, totalOpened, totalReplied, totalLeads, openRate, replyRate, recentCampaigns, recentReplies: recentReplies ?? [] };
}


export default async function OutreachOverviewPage() {
  const stats = await getStats();

  const cards = [
    { label: "Active Inboxes",   value: stats.inboxCount        ?? 0,                            color: "#3b82f6" },
    { label: "Active Campaigns", value: stats.activeCampaigns   ?? 0,                            color: "#a855f7" },
    { label: "Total Sent",       value: (stats.totalSent   ?? 0).toLocaleString(),               color: "#22c55e" },
    { label: "Total Leads",      value: (stats.totalLeads  ?? 0).toLocaleString(),               color: "#f59e0b" },
    { label: "Open Rate",        value: `${stats.openRate}%`,                                    color: "#06b6d4" },
    { label: "Reply Rate",       value: `${stats.replyRate}%`,                                   color: "#ec4899" },
    { label: "Total Replies",    value: (stats.totalReplied ?? 0).toLocaleString(),              color: "#84cc16" },
    { label: "Total Opened",     value: (stats.totalOpened  ?? 0).toLocaleString(),              color: "#f97316" },
  ];

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold text-white mb-1">Cold Outreach</h1>
      <p className="text-white/40 text-sm mb-8">All-time performance across all campaigns and inboxes.</p>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {cards.map((c) => (
          <div key={c.label} className="bg-white/4 border border-white/8 rounded-xl p-5">
            <div className="text-white/35 text-xs font-semibold uppercase tracking-wider mb-2">{c.label}</div>
            <div className="text-3xl font-bold" style={{ color: c.color }}>{c.value}</div>
          </div>
        ))}
      </div>

      {/* Recent CRM Replies */}
      {stats.recentReplies.length > 0 && (
        <div className="mt-8">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-white/70 font-semibold text-sm">Recent Replies</h2>
            <Link href="/admin/outreach/crm" className="text-xs text-blue-400 hover:text-blue-300">Open CRM →</Link>
          </div>
          <div className="space-y-2">
            {stats.recentReplies.map((reply) => {
              const categoryColors: Record<string, string> = {
                interested:     "text-emerald-400 bg-emerald-500/15",
                meeting_booked: "text-blue-400 bg-blue-500/15",
                not_interested: "text-red-400 bg-red-500/15",
                ooo:            "text-orange-400 bg-orange-500/15",
                follow_up:      "text-violet-400 bg-violet-500/15",
              };
              const catColor = reply.ai_category && (reply.ai_confidence ?? 0) >= 0.7
                ? categoryColors[reply.ai_category] ?? ""
                : "";
              const timeAgo = (() => {
                const diff = Date.now() - new Date(reply.received_at).getTime();
                const m = Math.floor(diff / 60000);
                if (m < 1) return "just now";
                if (m < 60) return `${m}m ago`;
                const h = Math.floor(m / 60);
                if (h < 24) return `${h}h ago`;
                return new Date(reply.received_at).toLocaleDateString("en-US", { month: "short", day: "numeric" });
              })();
              return (
                <Link key={reply.id} href="/admin/outreach/crm" className="flex items-center gap-3 bg-white/4 hover:bg-white/6 border border-white/8 rounded-xl px-4 py-3 transition-colors">
                  <div className="w-8 h-8 rounded-full bg-emerald-500/15 flex items-center justify-center flex-shrink-0">
                    <span className="text-emerald-400 text-xs font-bold">{(reply.from_name || reply.from_email).charAt(0).toUpperCase()}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-white text-sm font-medium truncate">{reply.from_name || reply.from_email}</span>
                      {catColor && (
                        <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-semibold flex-shrink-0 ${catColor}`}>
                          {reply.ai_category?.replace(/_/g, " ")}
                        </span>
                      )}
                    </div>
                    <p className="text-white/35 text-xs truncate">{reply.body_text?.slice(0, 80) ?? reply.subject ?? "(no body)"}</p>
                  </div>
                  <span className="text-white/25 text-[10px] flex-shrink-0">{timeAgo}</span>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* Recent Campaigns */}
      {stats.recentCampaigns.length > 0 && (
        <div className="mt-8">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-white/70 font-semibold text-sm">Recent Campaigns</h2>
            <Link href="/admin/outreach/campaigns" className="text-xs text-blue-400 hover:text-blue-300">View all →</Link>
          </div>
          <div className="border border-white/8 rounded-xl overflow-hidden">
            <div className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr] gap-4 px-5 py-3 bg-white/3 border-b border-white/6">
              {["Campaign", "Status", "Enrolled", "Open Rate", "Reply Rate"].map(h => (
                <div key={h} className="text-white/35 text-xs font-semibold uppercase tracking-wider">{h}</div>
              ))}
            </div>
            {stats.recentCampaigns.map((c, i) => (
              <div key={c.id} className={`grid grid-cols-[2fr_1fr_1fr_1fr_1fr] gap-4 items-center px-5 py-4 border-b border-white/4 last:border-0 ${i % 2 === 0 ? "" : "bg-white/1"}`}>
                <div>
                  <Link href={`/admin/outreach/campaigns/${c.id}`} className="text-white font-medium text-sm hover:text-blue-300 transition-colors">{c.name}</Link>
                  <div className="text-white/30 text-xs mt-0.5">{c.send_days?.join(", ")} · {c.send_start_time}–{c.send_end_time}</div>
                </div>
                <div><span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${c.status === "active" ? "text-green-400 bg-green-500/15" : "text-amber-400 bg-amber-500/15"}`}>{c.status}</span></div>
                <div className="text-white/60 text-sm">{c.enrolled.toLocaleString()}</div>
                <div className="text-sm font-medium" style={{ color: c.open_rate >= 40 ? "#4ade80" : c.open_rate >= 20 ? "#fbbf24" : c.open_rate > 0 ? "#94a3b8" : "#ffffff20" }}>
                  {c.sent > 0 ? `${c.open_rate}%` : "—"}
                </div>
                <div className="text-sm font-medium" style={{ color: c.reply_rate >= 10 ? "#4ade80" : c.reply_rate > 0 ? "#fbbf24" : "#ffffff20" }}>
                  {c.sent > 0 ? `${c.reply_rate}%` : "—"}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quick Start */}
      {(stats.inboxCount ?? 0) === 0 && (
        <div className="mt-10 bg-white/4 border border-white/8 rounded-xl p-6">
          <h2 className="text-white/70 font-semibold mb-4">Quick Start</h2>
          <ol className="space-y-3 text-sm text-white/50 list-decimal list-inside">
            <li>Connect a Gmail or Outlook inbox under <strong className="text-white/70">Inboxes</strong></li>
            <li>Enable warmup and let the inbox ramp up for 2–4 weeks before sending campaigns</li>
            <li>Upload a CSV lead list under <strong className="text-white/70">Leads</strong></li>
            <li>Create a campaign under <strong className="text-white/70">Campaigns</strong>, build your email sequence, and activate it</li>
            <li>Monitor replies in the <strong className="text-white/70">CRM</strong> tab</li>
          </ol>
        </div>
      )}
    </div>
  );
}
