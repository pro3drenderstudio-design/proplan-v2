"use client";

import { useEffect, useState, useMemo } from "react";
import { getAllLeads, getAllProjects } from "@/lib/admin-api";
import { Lead, Project } from "@/types/database";

const STATUS_STYLE: Record<string, string> = {
  new:       "text-blue-400   bg-blue-400/10",
  contacted: "text-amber-400  bg-amber-400/10",
  qualified: "text-violet-400 bg-violet-400/10",
  converted: "text-green-400  bg-green-400/10",
  lost:      "text-white/30   bg-white/5",
};

function fmt(n: number) {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}
function fmtDate(s: string) {
  return new Date(s).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default function AdminLeadsPage() {
  const [leads,    setLeads]    = useState<Lead[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [search,   setSearch]   = useState("");
  const [filter,   setFilter]   = useState("all");

  useEffect(() => {
    Promise.all([getAllLeads(), getAllProjects()]).then(([l, p]) => {
      setLeads(l); setProjects(p); setLoading(false);
    });
  }, []);

  const projectName = (id: string | null) => projects.find(p => p.id === id)?.name ?? "—";

  const filtered = useMemo(() => leads.filter(l => {
    if (filter !== "all" && l.status !== filter) return false;
    const name = `${l.first_name} ${l.last_name} ${l.email}`.toLowerCase();
    if (search && !name.includes(search.toLowerCase())) return false;
    return true;
  }), [leads, filter, search]);

  const totalValue   = leads.reduce((s, l) => s + l.total_value, 0);
  const avgValue     = leads.length ? totalValue / leads.length : 0;
  const converted    = leads.filter(l => l.status === "converted").length;
  const convRate     = leads.length ? Math.round((converted / leads.length) * 100) : 0;

  // Top projects by lead count
  const byProject = useMemo(() => {
    const map: Record<string, { name: string; count: number; value: number }> = {};
    leads.forEach(l => {
      const key = l.project_id ?? "unknown";
      if (!map[key]) map[key] = { name: projectName(l.project_id), count: 0, value: 0 };
      map[key].count++;
      map[key].value += l.total_value;
    });
    return Object.values(map).sort((a, b) => b.count - a.count).slice(0, 5);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leads, projects]);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-white/8 flex-shrink-0 flex items-center justify-between">
        <div>
          <h1 className="text-base font-bold text-white">Lead Intelligence</h1>
          <p className="text-xs text-white/35 mt-0.5">Cross-platform lead activity</p>
        </div>
        <div className="relative">
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search leads…"
            className="bg-[#252525] border border-white/15 rounded-lg pl-8 pr-3 py-1.5 text-sm text-white placeholder:text-white/25 focus:outline-none focus:border-blue-500/50 w-48"
          />
          <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
          </svg>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-5 space-y-5">

        {/* Stat row */}
        <div className="grid grid-cols-4 gap-3">
          {[
            { label: "Total Leads",     value: leads.length,  color: "text-white"       },
            { label: "Pipeline Value",  value: fmt(totalValue), color: "text-green-400" },
            { label: "Avg Quote",       value: fmt(avgValue),   color: "text-blue-400"  },
            { label: "Conversion Rate", value: `${convRate}%`,  color: "text-violet-400"},
          ].map(c => (
            <div key={c.label} className="bg-[#1a1a1a] border border-white/8 rounded-xl p-3.5">
              <p className="text-xs text-white/35 mb-1">{c.label}</p>
              <p className={`text-xl font-black ${c.color}`}>{loading ? "—" : c.value}</p>
            </div>
          ))}
        </div>

        {/* Top projects + table */}
        <div className="grid grid-cols-3 gap-5">
          {/* Top projects */}
          <div className="bg-[#1a1a1a] border border-white/8 rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-white/8">
              <p className="text-xs font-bold uppercase tracking-widest text-white/40">Top by Lead Volume</p>
            </div>
            <div className="p-3 space-y-2">
              {byProject.map((p, i) => (
                <div key={p.name} className="flex items-center gap-2.5">
                  <span className="text-xs text-white/20 w-4 tabular-nums">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-white truncate">{p.name}</p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <div className="h-1 rounded-full bg-blue-600/30 flex-1">
                        <div className="h-1 rounded-full bg-blue-500"
                          style={{ width: `${Math.min(100, (p.count / (byProject[0]?.count || 1)) * 100)}%` }} />
                      </div>
                      <span className="text-[10px] text-white/30 whitespace-nowrap">{p.count} leads</span>
                    </div>
                  </div>
                  <span className="text-xs text-green-400/70 whitespace-nowrap">{fmt(p.value)}</span>
                </div>
              ))}
              {!loading && byProject.length === 0 && (
                <p className="text-xs text-white/20 text-center py-4">No data</p>
              )}
            </div>
          </div>

          {/* Lead table */}
          <div className="col-span-2 bg-[#1a1a1a] border border-white/8 rounded-xl overflow-hidden flex flex-col">
            {/* Filter tabs */}
            <div className="flex items-center gap-1 px-3 py-2 border-b border-white/8 flex-shrink-0">
              {["all", "new", "contacted", "qualified", "converted", "lost"].map(s => (
                <button key={s} onClick={() => setFilter(s)}
                  className={`px-2.5 py-1 rounded text-xs font-medium capitalize transition-colors ${
                    filter === s ? "bg-blue-600 text-white" : "text-white/35 hover:text-white hover:bg-white/8"
                  }`}>
                  {s}
                </button>
              ))}
            </div>
            <div className="overflow-y-auto flex-1 max-h-[420px]">
              {loading ? (
                <div className="p-4 space-y-2">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="h-10 bg-white/4 rounded animate-pulse" />
                  ))}
                </div>
              ) : filtered.length === 0 ? (
                <div className="py-10 text-center text-white/25 text-xs">No leads match filters</div>
              ) : (
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-[#1a1a1a]">
                    <tr className="border-b border-white/8">
                      {["Name", "Project", "Value", "Status", "Date"].map(h => (
                        <th key={h} className="text-left px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-white/25">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {filtered.map(l => (
                      <tr key={l.id} className="hover:bg-white/4 transition-colors">
                        <td className="px-3 py-2.5">
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full bg-white/8 flex items-center justify-center text-[9px] font-bold text-white/50 flex-shrink-0">
                              {l.first_name?.[0]}{l.last_name?.[0]}
                            </div>
                            <div>
                              <p className="font-medium text-white/80">{l.first_name} {l.last_name}</p>
                              <p className="text-[10px] text-white/30">{l.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-2.5 text-white/40 truncate max-w-[120px]">{projectName(l.project_id)}</td>
                        <td className="px-3 py-2.5 text-green-400/80 font-semibold tabular-nums">
                          {l.total_value ? fmt(l.total_value) : "—"}
                        </td>
                        <td className="px-3 py-2.5">
                          <span className={`px-2 py-0.5 rounded-full font-medium text-[10px] ${STATUS_STYLE[l.status]}`}>
                            {l.status}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-white/25 whitespace-nowrap">{fmtDate(l.created_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
