"use client";

import { useEffect, useState } from "react";
import { getAdminStats, getAllProjects, AdminStats } from "@/lib/admin-api";
import { Project } from "@/types/database";

function timeStr() {
  return new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

type ProjectStatus = NonNullable<Project["status"]>;

const STATUS_LABELS: Record<ProjectStatus, string> = {
  pending_review: "New Request",
  in_development: "In Progress",
  in_review:      "Needs Mapping",
  live:           "Published Live",
  archived:       "Archived",
};

function deriveEvents(projects: Project[]) {
  return [...projects]
    .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
    .slice(0, 8)
    .map(p => {
      const status = p.status ?? "pending_review";
      const label = STATUS_LABELS[status] ?? status;
      const isNew = Date.now() - new Date(p.updated_at).getTime() < 3_600_000;
      return {
        time: new Date(p.updated_at).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
        tag:  status === "live" ? "LIVE" : isNew ? "NEW" : null,
        color: status === "live"
          ? "text-green-400 bg-green-400/10"
          : isNew ? "text-blue-400 bg-blue-400/10" : null,
        msg: `${p.name} — ${label}${p.company_slug ? ` (${p.company_slug})` : ""}`,
      };
    });
}

export default function MissionControlPage() {
  const [stats,    setStats]    = useState<AdminStats | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [now,      setNow]      = useState(timeStr());

  useEffect(() => {
    const t = setInterval(() => setNow(timeStr()), 1000);
    return () => clearInterval(t);
  }, []);

  function loadData() {
    setLoading(true);
    Promise.all([getAdminStats(), getAllProjects()]).then(([s, p]) => {
      setStats(s);
      setProjects(p);
      setLoading(false);
    });
  }

  useEffect(() => { loadData(); }, []);

  const stages = [
    {
      label: "Queue: New Requests",
      icon: "→",
      count: projects.filter(p => p.status === "pending_review").length,
      max: 20,
      status: "Pending",
      statusColor: "text-amber-400 bg-amber-400/10",
      barColor: "bg-amber-400",
    },
    {
      label: "Factory: In Modeling",
      icon: "⚡",
      count: projects.filter(p => p.status === "in_development").length,
      max: 20,
      status: "Active",
      statusColor: "text-blue-400 bg-blue-400/10",
      barColor: "bg-blue-400",
    },
    {
      label: "QA: Waiting for Mapping",
      icon: "🔍",
      count: projects.filter(p => p.status === "in_review").length,
      max: 20,
      status: "Pending",
      statusColor: "text-amber-400 bg-amber-400/10",
      barColor: "bg-violet-400",
    },
    {
      label: "Live: Published",
      icon: "✦",
      count: projects.filter(p => p.status === "live").length,
      max: 20,
      status: "Complete",
      statusColor: "text-green-400 bg-green-400/10",
      barColor: "bg-green-400",
    },
  ];

  const overdue = projects.filter(p => {
    const age = Date.now() - new Date(p.created_at).getTime();
    return age > 7 * 24 * 60 * 60 * 1000 && p.status !== "live" && p.status !== "archived";
  }).length;

  const statCards = [
    {
      label: "TOTAL PROJECTS",
      value: stats?.totalProjects ?? "—",
      sub: `${stats?.liveProjects ?? 0} live`,
      subColor: "text-green-400",
      icon: "📐",
    },
    {
      label: "TOTAL LEADS",
      value: stats?.totalLeads ?? "—",
      sub: `${stats?.newLeads ?? 0} new`,
      subColor: "text-blue-400",
      icon: "👥",
    },
    {
      label: "OVERDUE PROJECTS",
      value: overdue,
      sub: overdue > 0 ? "Requires attention" : "All on track",
      subColor: overdue > 0 ? "text-red-400" : "text-green-400",
      icon: "⚠",
      valueColor: overdue > 0 ? "text-red-400" : "text-white",
    },
    {
      label: "PENDING REVIEW",
      value: stats?.pendingRequests ?? "—",
      sub: stats?.pendingRequests === 0 ? "Queue clear" : "Awaiting action",
      subColor: (stats?.pendingRequests ?? 0) > 0 ? "text-amber-400" : "text-green-400",
      icon: "📋",
    },
  ];

  const recentEvents = deriveEvents(projects);

  return (
    <div className="flex flex-col h-full overflow-hidden">

      {/* Page Header */}
      <div className="px-6 py-4 border-b border-white/8 flex-shrink-0 flex items-center justify-between">
        <div>
          <h1 className="text-base font-bold text-white">Mission Control</h1>
          <p className="text-xs text-white/35 mt-0.5">Real-time overview of system operational health and metrics.</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={loadData}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/12 text-xs text-white/50 hover:text-white hover:border-white/25 transition-colors">
            <span className="text-[10px]">↻</span> Refresh
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-5">

        {/* Stat Cards */}
        <div className="grid grid-cols-4 gap-3">
          {statCards.map(c => (
            <div key={c.label} className="bg-[#1a1a1a] border border-white/8 rounded-xl p-4">
              <p className="text-[9px] font-bold uppercase tracking-widest text-white/30 mb-2">{c.label}</p>
              <p className={`text-2xl font-black tracking-tight ${c.valueColor ?? "text-white"} ${loading ? "animate-pulse" : ""}`}>
                {loading ? "—" : c.value}
              </p>
              <p className={`text-[10px] mt-1 font-medium ${c.subColor}`}>{loading ? "—" : c.sub}</p>
            </div>
          ))}
        </div>

        {/* Two-column grid */}
        <div className="grid grid-cols-3 gap-5">

          {/* Left: Pipeline */}
          <div className="col-span-2 space-y-5">

            {/* Pipeline Health */}
            <div className="bg-[#1a1a1a] border border-white/8 rounded-xl overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-white/8">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-white/70 uppercase tracking-wider">→ Production Pipeline Health</span>
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-green-400/10 text-green-400 border border-green-400/20">
                  PIPELINE ACTIVE
                </span>
              </div>

              <div className="divide-y divide-white/5">
                {stages.map(stage => (
                  <div key={stage.label} className="flex items-center gap-4 px-4 py-3.5">
                    <div className="w-5 text-center text-sm">{stage.icon}</div>
                    <div className="w-44 flex-shrink-0">
                      <p className="text-xs font-medium text-white/80">{stage.label}</p>
                    </div>
                    <div className="flex-1 flex items-center gap-3">
                      <span className="text-[10px] text-white/35 w-12 flex-shrink-0">Volume</span>
                      <div className="flex-1 bg-white/6 rounded-full h-1.5">
                        <div
                          className={`h-1.5 rounded-full transition-all ${stage.barColor}`}
                          style={{ width: `${Math.min(100, (stage.count / stage.max) * 100)}%` }}
                        />
                      </div>
                      <span className="text-xs font-bold text-white/60 w-6 text-right">{loading ? "—" : stage.count}</span>
                    </div>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${stage.statusColor} flex-shrink-0`}>
                      {stage.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>

          </div>

          {/* Right: Recent Events */}
          <div className="bg-[#1a1a1a] border border-white/8 rounded-xl overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/8 flex-shrink-0">
              <span className="text-xs font-bold text-white/70 uppercase tracking-wider">Recent Events</span>
              <div className="flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                <span className="text-[10px] text-white/30 font-mono">{now}</span>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto divide-y divide-white/5">
              {loading ? (
                <div className="px-4 py-8 text-center text-white/20 text-xs">Loading…</div>
              ) : recentEvents.length === 0 ? (
                <div className="px-4 py-8 text-center text-white/20 text-xs">No project activity yet.</div>
              ) : recentEvents.map((ev, i) => (
                <div key={i} className="px-4 py-3 flex gap-3 items-start">
                  <div className="w-1.5 h-1.5 rounded-full bg-blue-500/60 flex-shrink-0 mt-1.5" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-[10px] font-mono text-white/30">{ev.time}</span>
                      {ev.tag && (
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${ev.color}`}>{ev.tag}</span>
                      )}
                    </div>
                    <p className="text-xs text-white/65 leading-snug truncate">{ev.msg}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
