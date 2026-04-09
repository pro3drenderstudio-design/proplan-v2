"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { getCampaigns, updateCampaign, deleteCampaign, cloneCampaign } from "@/lib/outreach/api";
import type { OutreachCampaign, CampaignStatus } from "@/types/outreach";

const STATUS_COLORS: Record<CampaignStatus, string> = {
  draft:     "text-white/40 bg-white/8",
  active:    "text-green-400 bg-green-500/15",
  paused:    "text-amber-400 bg-amber-500/15",
  completed: "text-blue-400 bg-blue-500/15",
};

const ALL_STATUSES: Array<CampaignStatus | "all"> = ["all", "active", "paused", "draft", "completed"];

export default function CampaignsClient() {
  const [campaigns, setCampaigns] = useState<OutreachCampaign[]>([]);
  const [loading, setLoading]     = useState(true);
  const [search, setSearch]       = useState("");
  const [statusFilter, setStatusFilter] = useState<CampaignStatus | "all">("all");

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    setCampaigns(await getCampaigns());
    setLoading(false);
  }

  async function toggleStatus(c: OutreachCampaign) {
    const next = c.status === "active" ? "paused" : c.status === "paused" ? "active" : "active";
    await updateCampaign(c.id, { status: next as CampaignStatus });
    load();
  }

  async function handleDelete(c: OutreachCampaign) {
    if (!confirm(`Delete campaign "${c.name}"? This cannot be undone.`)) return;
    await deleteCampaign(c.id); load();
  }

  async function handleClone(c: OutreachCampaign) {
    await cloneCampaign(c.id);
    load();
  }

  const filtered = campaigns.filter(c => {
    const matchesSearch = c.name.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === "all" || c.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const countByStatus = (s: CampaignStatus | "all") =>
    s === "all" ? campaigns.length : campaigns.filter(c => c.status === s).length;

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-white">Campaigns</h1>
          <p className="text-white/40 text-sm mt-0.5">Create and manage cold email sequences</p>
        </div>
        <Link href="/admin/outreach/campaigns/new" className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm font-semibold transition-colors">
          + New Campaign
        </Link>
      </div>

      {/* Search + Status Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <input
          type="text"
          placeholder="Search campaigns…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="flex-1 px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder-white/30 focus:outline-none focus:border-blue-500/50"
        />
        <div className="flex gap-1 bg-white/4 border border-white/8 rounded-xl p-1">
          {ALL_STATUSES.map(s => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-colors ${
                statusFilter === s
                  ? "bg-white/12 text-white"
                  : "text-white/40 hover:text-white/60"
              }`}
            >
              {s === "all" ? "All" : s}
              {s !== "all" && countByStatus(s) > 0 && (
                <span className="ml-1 text-white/30">{countByStatus(s)}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">{[1,2,3].map((i) => <div key={i} className="h-20 bg-white/4 rounded-xl animate-pulse" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-white/30">
          <div className="text-4xl mb-3">✉️</div>
          <p className="font-medium">{search || statusFilter !== "all" ? "No campaigns match your filters" : "No campaigns yet"}</p>
          {!search && statusFilter === "all" && <p className="text-sm mt-1">Create your first campaign to start sending</p>}
        </div>
      ) : (
        <div className="border border-white/8 rounded-xl overflow-hidden">
          <div className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr_1fr_220px] gap-4 px-5 py-3 bg-white/3 border-b border-white/6">
            {["Campaign", "Status", "Enrolled", "Sent", "Open Rate", "Replies", ""].map((h) => (
              <div key={h} className="text-white/35 text-xs font-semibold uppercase tracking-wider">{h}</div>
            ))}
          </div>
          {filtered.map((c, i) => {
            const enrolled  = c.total_enrolled ?? 0;
            const sent      = c.total_sent     ?? 0;
            const opened    = c.total_opened   ?? 0;
            const replied   = c.total_replied  ?? 0;
            const openRate  = sent > 0 ? Math.round((opened / sent) * 100) : 0;
            const progress  = enrolled > 0 ? Math.round(((replied) / enrolled) * 100) : 0;

            return (
              <div key={c.id} className={`grid grid-cols-[2fr_1fr_1fr_1fr_1fr_1fr_220px] gap-4 items-center px-5 py-4 border-b border-white/4 last:border-0 ${i % 2 === 0 ? "" : "bg-white/1"}`}>
                <div>
                  <Link href={`/admin/outreach/campaigns/${c.id}`} className="text-white font-medium text-sm hover:text-blue-300 transition-colors">{c.name}</Link>
                  <div className="text-white/30 text-xs mt-0.5">{c.send_days?.join(", ")} · {c.send_start_time}–{c.send_end_time}</div>
                  {c.status === "active" && enrolled > 0 && (
                    <div className="mt-1.5 flex items-center gap-2">
                      <div className="flex-1 h-1 bg-white/8 rounded-full overflow-hidden">
                        <div className="h-full bg-green-500/60 rounded-full transition-all" style={{ width: `${progress}%` }} />
                      </div>
                      <span className="text-white/25 text-xs">{progress}% replied</span>
                    </div>
                  )}
                </div>
                <div><span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${STATUS_COLORS[c.status]}`}>{c.status}</span></div>
                <div className="text-white/60 text-sm">{enrolled.toLocaleString()}</div>
                <div className="text-white/60 text-sm">{sent.toLocaleString()}</div>
                <div className="text-sm font-medium" style={{ color: openRate >= 40 ? "#4ade80" : openRate >= 20 ? "#fbbf24" : openRate > 0 ? "#94a3b8" : "#ffffff20" }}>
                  {sent > 0 ? `${openRate}%` : "—"}
                </div>
                <div className="text-white/60 text-sm">{replied.toLocaleString()}</div>
                <div className="flex items-center gap-1.5">
                  {c.status !== "completed" && (
                    <button onClick={() => toggleStatus(c)} className="px-2.5 py-1.5 bg-white/6 hover:bg-white/10 text-white/60 hover:text-white text-xs rounded-lg transition-colors">
                      {c.status === "active" ? "Pause" : "Activate"}
                    </button>
                  )}
                  <Link href={`/admin/outreach/campaigns/${c.id}`} className="px-2.5 py-1.5 bg-white/6 hover:bg-white/10 text-white/60 hover:text-white text-xs rounded-lg transition-colors">Edit</Link>
                  <button onClick={() => handleClone(c)} className="px-2.5 py-1.5 bg-white/6 hover:bg-white/10 text-white/60 hover:text-white text-xs rounded-lg transition-colors">Duplicate</button>
                  <button onClick={() => handleDelete(c)} className="px-2.5 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs rounded-lg transition-colors">Delete</button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
