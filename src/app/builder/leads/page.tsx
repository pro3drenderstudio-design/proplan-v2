"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { getLeads, getBuilderProjects, updateLeadStatus, Lead, LeadStatus } from "@/lib/builder-api";
import { Project } from "@/types/database";

const STATUS_OPTIONS: { value: LeadStatus; label: string; style: string }[] = [
  { value: "new",       label: "New",       style: "bg-blue-500/12 text-blue-400 border border-blue-500/20"      },
  { value: "contacted", label: "Contacted", style: "bg-amber-500/12 text-amber-400 border border-amber-500/20"   },
  { value: "qualified", label: "Qualified", style: "bg-violet-500/12 text-violet-400 border border-violet-500/20"},
  { value: "converted", label: "Converted", style: "bg-emerald-500/12 text-emerald-400 border border-emerald-500/20"},
  { value: "lost",      label: "Lost",      style: "bg-white/5 text-white/25 border border-white/8"              },
];

function statusStyle(s: LeadStatus) {
  return STATUS_OPTIONS.find(o => o.value === s)?.style ?? "bg-white/5 text-white/25 border border-white/8";
}

function fmt(n: number) {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

export default function LeadsPage() {
  const router = useRouter();
  const [leads,         setLeads]         = useState<Lead[]>([]);
  const [projects,      setProjects]      = useState<Project[]>([]);
  const [loading,       setLoading]       = useState(true);
  const [search,        setSearch]        = useState("");
  const [filterStatus,  setFilterStatus]  = useState<LeadStatus | "all">("all");
  const [filterProject, setFilterProject] = useState("all");

  useEffect(() => {
    Promise.all([getLeads(), getBuilderProjects()]).then(([l, p]) => {
      setLeads(l);
      setProjects(p);
      setLoading(false);
    });
  }, []);

  const filtered = useMemo(() => {
    return leads.filter(l => {
      const name = `${l.first_name} ${l.last_name} ${l.email}`.toLowerCase();
      if (search && !name.includes(search.toLowerCase())) return false;
      if (filterStatus !== "all" && l.status !== filterStatus) return false;
      if (filterProject !== "all" && l.project_id !== filterProject) return false;
      return true;
    });
  }, [leads, search, filterStatus, filterProject]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: leads.length };
    for (const s of STATUS_OPTIONS) c[s.value] = leads.filter(l => l.status === s.value).length;
    return c;
  }, [leads]);

  async function handleStatusChange(lead: Lead, status: LeadStatus) {
    const ok = await updateLeadStatus(lead.id, status);
    if (ok) setLeads(prev => prev.map(l => l.id === lead.id ? { ...l, status } : l));
  }

  const projectName = (id: string | null) =>
    projects.find(p => p.id === id)?.name ?? "—";

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto">

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1
            className="text-2xl font-extrabold text-white tracking-tight"
            style={{ fontFamily: "var(--font-syne), sans-serif" }}
          >
            Leads CRM
          </h1>
          <p className="text-sm text-white/30 mt-0.5">Track and manage everyone who configured through your projects.</p>
        </div>
        <button
          onClick={() => {
            const rows = [["Name","Email","Phone","Project","Value","Status","Date"]];
            filtered.forEach(l => rows.push([
              `${l.first_name} ${l.last_name}`, l.email, l.phone ?? "",
              projectName(l.project_id), String(l.total_value), l.status,
              new Date(l.created_at).toLocaleDateString(),
            ]));
            const csv = rows.map(r => r.join(",")).join("\n");
            const a = document.createElement("a");
            a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
            a.download = "leads.csv";
            a.click();
          }}
          className="flex items-center gap-2 px-4 py-2 rounded-xl border border-white/10 text-sm font-medium text-white/50 hover:text-white hover:bg-white/5 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          Export CSV
        </button>
      </div>

      {/* Status filter tabs */}
      <div className="flex gap-2 mb-5 flex-wrap">
        {[{ value: "all", label: "All" }, ...STATUS_OPTIONS].map(opt => (
          <button key={opt.value}
            onClick={() => setFilterStatus(opt.value as LeadStatus | "all")}
            className={`px-3 py-1.5 rounded-xl text-sm font-semibold transition-all border ${
              filterStatus === opt.value
                ? "bg-blue-600 text-white border-blue-600 shadow-lg shadow-blue-600/15"
                : "bg-[#0e0e0e] text-white/35 border-white/8 hover:text-white/70 hover:border-white/14"
            }`}>
            {opt.label} <span className="ml-1 text-xs opacity-60">({counts[opt.value] ?? 0})</span>
          </button>
        ))}
      </div>

      {/* Search + project filter */}
      <div className="flex gap-3 mb-5">
        <div className="relative flex-1 max-w-xs">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/25" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search leads…"
            className="w-full pl-9 pr-3 py-2 bg-[#0e0e0e] border border-white/8 rounded-xl text-sm text-white/70 placeholder-white/20 focus:outline-none focus:ring-1 focus:ring-blue-500/60 focus:border-blue-500/40 transition-colors" />
        </div>
        <select value={filterProject} onChange={e => setFilterProject(e.target.value)}
          className="bg-[#0e0e0e] border border-white/8 rounded-xl px-3 py-2 text-sm text-white/50 focus:outline-none focus:ring-1 focus:ring-blue-500/60 transition-colors">
          <option value="all">All Projects</option>
          {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>

      {/* Table */}
      <div className="bg-[#0e0e0e] rounded-2xl border border-white/8 overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-white/25 text-sm">Loading leads…</div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-white/25 text-sm">
              {leads.length === 0 ? "No leads yet. Leads appear when visitors submit their configuration." : "No leads match your filters."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/8 bg-white/3">
                  {["Name","Contact","Project","Config Value","Status","Date",""].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-[10px] font-semibold text-white/25 uppercase tracking-widest whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filtered.map(lead => (
                  <tr key={lead.id}
                    onClick={() => router.push(`/builder/leads/${lead.id}`)}
                    className="hover:bg-white/3 cursor-pointer transition-colors">
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-600/30 to-violet-600/20 border border-white/10 flex items-center justify-center text-xs font-bold text-white/60 flex-shrink-0">
                          {lead.first_name?.[0]}{lead.last_name?.[0]}
                        </div>
                        <p className="font-semibold text-white/80 whitespace-nowrap">
                          {lead.first_name} {lead.last_name}
                        </p>
                      </div>
                    </td>
                    <td className="px-4 py-3.5">
                      <p className="text-white/50">{lead.email}</p>
                      {lead.phone && <p className="text-xs text-white/25">{lead.phone}</p>}
                    </td>
                    <td className="px-4 py-3.5 text-white/40 whitespace-nowrap">{projectName(lead.project_id)}</td>
                    <td className="px-4 py-3.5 font-bold text-white/70">
                      {lead.total_value ? fmt(lead.total_value) : <span className="text-white/20">—</span>}
                    </td>
                    <td className="px-4 py-3.5">
                      <select
                        value={lead.status}
                        onClick={e => e.stopPropagation()}
                        onChange={e => handleStatusChange(lead, e.target.value as LeadStatus)}
                        className={`text-xs px-2.5 py-1 rounded-full font-semibold cursor-pointer focus:outline-none bg-transparent ${statusStyle(lead.status)}`}>
                        {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                    </td>
                    <td className="px-4 py-3.5 text-white/25 text-xs whitespace-nowrap">
                      {new Date(lead.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                    </td>
                    <td className="px-4 py-3.5">
                      <span className="text-blue-400 text-xs font-medium">View →</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
