"use client";

import { useEffect, useState, useMemo } from "react";
import { getAdminStats, getAllLeads, getAllProjects, AdminStats } from "@/lib/admin-api";
import { Lead, Project } from "@/types/database";

function fmt(n: number) {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

const LEAD_STATUS_STYLE: Record<string, string> = {
  new:       "text-blue-400 bg-blue-400/10",
  contacted: "text-amber-400 bg-amber-400/10",
  qualified: "text-violet-400 bg-violet-400/10",
  converted: "text-green-400 bg-green-400/10",
  lost:      "text-white/30 bg-white/5",
};

export default function AnalyticsPage() {
  const [stats,    setStats]    = useState<AdminStats | null>(null);
  const [leads,    setLeads]    = useState<Lead[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading,  setLoading]  = useState(true);

  useEffect(() => {
    Promise.all([getAdminStats(), getAllLeads(), getAllProjects()]).then(([s, l, p]) => {
      setStats(s);
      setLeads(l);
      setProjects(p);
      setLoading(false);
    });
  }, []);

  const byStatus = useMemo(() => {
    const map: Record<string, number> = {};
    leads.forEach(l => { map[l.status] = (map[l.status] ?? 0) + 1; });
    return map;
  }, [leads]);

  const totalValue = useMemo(() => leads.reduce((s, l) => s + (l.total_value ?? 0), 0), [leads]);
  const avgValue   = leads.length > 0 ? totalValue / leads.length : 0;
  const convRate   = leads.length > 0 ? ((byStatus.converted ?? 0) / leads.length) * 100 : 0;

  const topProjects = useMemo(() => {
    const map: Record<string, { name: string; count: number; value: number }> = {};
    leads.forEach(l => {
      if (!l.project_id) return;
      const proj = projects.find(p => p.id === l.project_id);
      if (!proj) return;
      if (!map[l.project_id]) map[l.project_id] = { name: proj.name, count: 0, value: 0 };
      map[l.project_id].count++;
      map[l.project_id].value += l.total_value ?? 0;
    });
    return Object.values(map).sort((a, b) => b.count - a.count).slice(0, 6);
  }, [leads, projects]);

  const maxCount = topProjects[0]?.count ?? 1;

  const statCards = [
    { label: "Total Leads",       value: stats?.totalLeads ?? "—",      sub: `${byStatus.new ?? 0} new this period`,         color: "text-white" },
    { label: "Pipeline Value",    value: fmt(totalValue),                sub: `${byStatus.converted ?? 0} converted`,        color: "text-green-400" },
    { label: "Avg Quote Value",   value: fmt(avgValue),                  sub: "per lead",                                    color: "text-blue-400" },
    { label: "Conversion Rate",   value: `${convRate.toFixed(1)}%`,      sub: `${byStatus.qualified ?? 0} qualified`,        color: "text-violet-400" },
  ];

  return (
    <div className="flex flex-col h-full overflow-hidden">

      <div className="px-6 py-4 border-b border-white/8 flex-shrink-0 flex items-center justify-between">
        <div>
          <h1 className="text-base font-bold text-white">Analytics</h1>
          <p className="text-xs text-white/35 mt-0.5">Lead intelligence and platform performance metrics.</p>
        </div>
        <div className="flex items-center gap-2">
          <select className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white/50 outline-none">
            <option>All Time</option>
            <option>Last 30 Days</option>
            <option>Last 7 Days</option>
          </select>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-5">

        {/* Stat cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {statCards.map(c => (
            <div key={c.label} className={`bg-[#1a1a1a] border border-white/8 rounded-xl p-4 ${loading ? "animate-pulse" : ""}`}>
              <p className="text-[9px] font-bold uppercase tracking-widest text-white/30 mb-2">{c.label}</p>
              <p className={`text-2xl font-black tracking-tight ${c.color}`}>{loading ? "—" : c.value}</p>
              <p className="text-[10px] text-white/30 mt-1">{c.sub}</p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">

          {/* Lead Status Breakdown */}
          <div className="bg-[#1a1a1a] border border-white/8 rounded-xl p-5">
            <h3 className="text-xs font-bold text-white mb-4">Lead Status Breakdown</h3>
            <div className="space-y-3">
              {["new", "contacted", "qualified", "converted", "lost"].map(status => {
                const count = byStatus[status] ?? 0;
                const pct = leads.length > 0 ? (count / leads.length) * 100 : 0;
                return (
                  <div key={status}>
                    <div className="flex items-center justify-between mb-1">
                      <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full capitalize ${LEAD_STATUS_STYLE[status]}`}>{status}</span>
                      <span className="text-xs text-white/40">{count} <span className="text-white/20">({pct.toFixed(0)}%)</span></span>
                    </div>
                    <div className="w-full bg-white/6 rounded-full h-1.5">
                      <div
                        className={`h-1.5 rounded-full ${
                          status === "new"       ? "bg-blue-500" :
                          status === "contacted" ? "bg-amber-500" :
                          status === "qualified" ? "bg-violet-500" :
                          status === "converted" ? "bg-green-500" : "bg-white/20"
                        }`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Top Projects by Lead Volume */}
          <div className="md:col-span-2 bg-[#1a1a1a] border border-white/8 rounded-xl p-5">
            <h3 className="text-xs font-bold text-white mb-4">Top Projects by Lead Volume</h3>
            {topProjects.length === 0 ? (
              <p className="text-xs text-white/25 text-center py-8">No lead data yet</p>
            ) : (
              <div className="space-y-3">
                {topProjects.map((proj, i) => (
                  <div key={i}>
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-xs text-white/70 truncate max-w-[60%]">
                        <span className="text-white/30 mr-2">#{i + 1}</span>
                        {proj.name}
                      </p>
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-white/40">{proj.count} leads</span>
                        <span className="text-xs font-medium text-green-400">{fmt(proj.value)}</span>
                      </div>
                    </div>
                    <div className="w-full bg-white/6 rounded-full h-1.5">
                      <div
                        className="h-1.5 rounded-full bg-gradient-to-r from-blue-500 to-violet-500"
                        style={{ width: `${(proj.count / maxCount) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Recent leads table */}
        <div className="bg-[#1a1a1a] border border-white/8 rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/8">
            <h3 className="text-xs font-bold text-white">All Leads</h3>
            <p className="text-xs text-white/30">{leads.length} total</p>
          </div>
          {leads.length === 0 ? (
            <div className="py-12 text-center text-white/25 text-xs">No leads yet</div>
          ) : (
            <div className="overflow-x-auto">
            <div className="min-w-[520px]">
              <div className="grid grid-cols-12 gap-4 px-4 py-2 text-[9px] font-bold uppercase tracking-widest text-white/25 border-b border-white/5">
                <span className="col-span-3">Lead</span>
                <span className="col-span-3">Project</span>
                <span className="col-span-2">Value</span>
                <span className="col-span-2">Status</span>
                <span className="col-span-2">Date</span>
              </div>
              <div className="divide-y divide-white/5 max-h-80 overflow-y-auto">
                {leads.map(l => (
                  <div key={l.id} className="grid grid-cols-12 gap-4 items-center px-4 py-3 hover:bg-white/3 transition-colors">
                    <div className="col-span-3 flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-white/8 flex items-center justify-center text-[9px] font-bold text-white/50 flex-shrink-0">
                        {(l.first_name?.[0] ?? "") + (l.last_name?.[0] ?? "")}
                      </div>
                      <div>
                        <p className="text-xs text-white/70">{l.first_name} {l.last_name}</p>
                        <p className="text-[10px] text-white/30 truncate">{l.email}</p>
                      </div>
                    </div>
                    <div className="col-span-3">
                      <p className="text-xs text-white/50 truncate">
                        {projects.find(p => p.id === l.project_id)?.name ?? "—"}
                      </p>
                    </div>
                    <div className="col-span-2">
                      <p className="text-xs text-white/60">{l.total_value ? fmt(l.total_value) : "—"}</p>
                    </div>
                    <div className="col-span-2">
                      <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full capitalize ${LEAD_STATUS_STYLE[l.status]}`}>
                        {l.status}
                      </span>
                    </div>
                    <div className="col-span-2">
                      <p className="text-[10px] text-white/30">
                        {new Date(l.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
