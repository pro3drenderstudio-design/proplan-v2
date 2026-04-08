"use client";

import { useEffect, useState, useMemo, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getAllProjects, getAllBuildersBySlug, getAwaitingPaymentRequests, deleteProjectRequest } from "@/lib/admin-api";
import { Project, Builder, ProjectRequest } from "@/types/database";

const STATUS_MAP: Record<NonNullable<Project["status"]>, { label: string; style: string }> = {
  pending_review: { label: "New Request",   style: "text-amber-400 bg-amber-400/10 border-amber-400/30" },
  in_development: { label: "In Progress",   style: "text-blue-400 bg-blue-400/10 border-blue-400/30" },
  in_review:      { label: "Needs Mapping", style: "text-teal-300 bg-teal-400/10 border-teal-400/30" },
  live:           { label: "Live",          style: "text-green-400 bg-green-400/10 border-green-400/20" },
  archived:       { label: "Archived",      style: "text-white/30 bg-white/5 border-white/10" },
};

const EXPORT_STATUSES = [
  { key: "all",            label: "All Projects" },
  { key: "pending_review", label: "New Requests" },
  { key: "in_development", label: "In Progress" },
  { key: "in_review",      label: "Needs Mapping" },
  { key: "live",           label: "Live" },
  { key: "archived",       label: "Archived" },
];

function timeInQueue(updated: string): { label: string; urgent: boolean } {
  const ms    = Date.now() - new Date(updated).getTime();
  const hours = Math.floor(ms / 3_600_000);
  const days  = Math.floor(ms / 86_400_000);
  if (hours < 24) return { label: `${hours}h`, urgent: true };
  if (days === 1)  return { label: "1 Day",    urgent: false };
  return { label: `${days} Days`, urgent: false };
}

function shortId(id: string) {
  return id.slice(0, 4).toUpperCase() + "-" + id.slice(4, 8).toUpperCase();
}

function exportToCSV(projects: Project[], builders: Record<string, Builder>, statusKey: string, statusLabel: string) {
  const rows = projects.filter(p =>
    statusKey === "all" ? true : p.status === statusKey
  );
  const headers = ["ID", "Project Name", "Builder", "Status", "Beds", "Baths", "Floors", "Sqft", "Base Price", "Created", "Updated"];
  const csv = [
    headers.join(","),
    ...rows.map(p => {
      const builder = p.company_slug ? builders[p.company_slug] : null;
      return [
        shortId(p.id),
        `"${p.name}"`,
        `"${builder?.company_name ?? p.company_slug ?? ""}"`,
        STATUS_MAP[p.status ?? "pending_review"]?.label ?? "",
        p.beds ?? "",
        p.baths ?? "",
        p.floors ?? "",
        p.sqft ?? "",
        p.base_price ?? "",
        new Date(p.created_at).toLocaleDateString(),
        new Date(p.updated_at).toLocaleDateString(),
      ].join(",");
    })
  ].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `projects-${statusLabel.toLowerCase().replace(/\s+/g, "-")}-${new Date().toISOString().slice(0,10)}.csv`;
  a.click();
}

const PER_PAGE = 12;

export default function ProductionQueuePage() {
  const router = useRouter();
  const [projects,       setProjects]       = useState<Project[]>([]);
  const [unpaidRequests, setUnpaidRequests] = useState<ProjectRequest[]>([]);
  const [deletingId,     setDeletingId]     = useState<string | null>(null);
  const [builders,       setBuilders]       = useState<Record<string, Builder>>({});
  const [loading,        setLoading]        = useState(true);
  const [search,        setSearch]        = useState("");
  const [statusFilter,  setStatusFilter]  = useState<string>("all");
  const [builderFilter, setBuilderFilter] = useState<string>("all");
  const [page,          setPage]          = useState(1);
  const [showExport,    setShowExport]    = useState(false);
  const [showFilter,    setShowFilter]    = useState(false);
  const exportRef = useRef<HTMLDivElement>(null);
  const filterRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    Promise.all([getAllProjects(), getAllBuildersBySlug(), getAwaitingPaymentRequests()]).then(([p, b, u]) => {
      setProjects(p);
      setBuilders(b);
      setUnpaidRequests(u);
      setLoading(false);
    });
  }, []);

  async function handleDeleteRequest(id: string) {
    if (!confirm("Remove this unpaid request? This cannot be undone.")) return;
    setDeletingId(id);
    await deleteProjectRequest(id);
    setUnpaidRequests(prev => prev.filter(r => r.id !== id));
    setDeletingId(null);
  }

  // Close dropdowns on outside click
  useEffect(() => {
    function handle(e: MouseEvent) {
      if (exportRef.current && !exportRef.current.contains(e.target as Node)) setShowExport(false);
      if (filterRef.current && !filterRef.current.contains(e.target as Node)) setShowFilter(false);
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, []);

  const builderOptions = useMemo(() => {
    const seen = new Set<string>();
    const opts: { slug: string; name: string }[] = [];
    for (const p of projects) {
      if (p.company_slug && !seen.has(p.company_slug)) {
        seen.add(p.company_slug);
        opts.push({ slug: p.company_slug, name: builders[p.company_slug]?.company_name ?? p.company_slug });
      }
    }
    return opts.sort((a, b) => a.name.localeCompare(b.name));
  }, [projects, builders]);

  const filtered = useMemo(() => {
    return projects.filter(p => {
      const matchSearch  = !search || p.name.toLowerCase().includes(search.toLowerCase());
      const matchStatus  = statusFilter === "all" ? true : p.status === statusFilter;
      const matchBuilder = builderFilter === "all" ? true : p.company_slug === builderFilter;
      return matchSearch && matchStatus && matchBuilder;
    });
  }, [projects, search, statusFilter, builderFilter]);

  const paged      = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);
  const totalPages = Math.ceil(filtered.length / PER_PAGE);

  const newCount     = projects.filter(p => p.status === "pending_review").length;
  const mappingCount = projects.filter(p => p.status === "in_review").length;
  const liveCount    = projects.filter(p => p.status === "live").length;

  const activeFilters = (statusFilter !== "all" ? 1 : 0) + (builderFilter !== "all" ? 1 : 0);

  return (
    <div className="flex flex-col h-full overflow-hidden">

      {/* Header */}
      <div className="px-4 md:px-6 py-4 border-b border-white/8 flex-shrink-0 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-base font-bold text-white">Production Pipeline</h1>
          <p className="text-xs text-white/35 mt-0.5 hidden sm:block">Manage active floor plan conversions and mapping tasks.</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">

          {/* Filter button */}
          <div className="relative" ref={filterRef}>
            <button
              onClick={() => { setShowFilter(v => !v); setShowExport(false); }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs transition-colors ${
                activeFilters > 0
                  ? "border-blue-500/40 text-blue-400 bg-blue-500/10"
                  : "border-white/12 text-white/50 hover:text-white hover:border-white/25"
              }`}>
              <FilterIcon className="w-3.5 h-3.5" />
              Filter{activeFilters > 0 ? ` (${activeFilters})` : ""}
            </button>
            {showFilter && (
              <div className="absolute right-0 top-full mt-1.5 w-56 bg-[#1a1a1a] border border-white/12 rounded-xl shadow-2xl z-50 p-3 space-y-3">
                <div>
                  <p className="text-[9px] font-bold uppercase tracking-widest text-white/30 mb-2">Status</p>
                  <div className="space-y-1">
                    {[{ key: "all", label: "All Statuses" }, ...EXPORT_STATUSES.slice(1)].map(opt => (
                      <button key={opt.key}
                        onClick={() => { setStatusFilter(opt.key); setPage(1); }}
                        className={`w-full text-left text-xs px-2.5 py-1.5 rounded-lg transition-colors ${
                          statusFilter === opt.key
                            ? "bg-blue-600/20 text-blue-400"
                            : "text-white/50 hover:text-white hover:bg-white/8"
                        }`}>
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
                {builderOptions.length > 0 && (
                  <div>
                    <p className="text-[9px] font-bold uppercase tracking-widest text-white/30 mb-2">Builder</p>
                    <div className="space-y-1 max-h-32 overflow-y-auto">
                      <button
                        onClick={() => { setBuilderFilter("all"); setPage(1); }}
                        className={`w-full text-left text-xs px-2.5 py-1.5 rounded-lg transition-colors ${
                          builderFilter === "all" ? "bg-blue-600/20 text-blue-400" : "text-white/50 hover:text-white hover:bg-white/8"
                        }`}>
                        All Builders
                      </button>
                      {builderOptions.map(b => (
                        <button key={b.slug}
                          onClick={() => { setBuilderFilter(b.slug); setPage(1); }}
                          className={`w-full text-left text-xs px-2.5 py-1.5 rounded-lg transition-colors ${
                            builderFilter === b.slug ? "bg-blue-600/20 text-blue-400" : "text-white/50 hover:text-white hover:bg-white/8"
                          }`}>
                          {b.name}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {activeFilters > 0 && (
                  <button
                    onClick={() => { setStatusFilter("all"); setBuilderFilter("all"); setPage(1); }}
                    className="w-full text-xs text-red-400/70 hover:text-red-400 transition-colors pt-1 border-t border-white/8">
                    Clear filters
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Export button */}
          <div className="relative" ref={exportRef}>
            <button
              onClick={() => { setShowExport(v => !v); setShowFilter(false); }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/12 text-xs text-white/50 hover:text-white hover:border-white/25 transition-colors">
              <ExportIcon className="w-3.5 h-3.5" /> Export
            </button>
            {showExport && (
              <div className="absolute right-0 top-full mt-1.5 w-48 bg-[#1a1a1a] border border-white/12 rounded-xl shadow-2xl z-50 py-1.5">
                <p className="text-[9px] font-bold uppercase tracking-widest text-white/30 px-3 py-2">Export as CSV</p>
                {EXPORT_STATUSES.map(opt => (
                  <button key={opt.key}
                    onClick={() => { exportToCSV(projects, builders, opt.key, opt.label); setShowExport(false); }}
                    className="w-full text-left text-xs px-3 py-2 text-white/60 hover:text-white hover:bg-white/8 transition-colors">
                    {opt.label}
                    <span className="text-white/25 ml-1.5">
                      ({opt.key === "all" ? projects.length : projects.filter(p => p.status === opt.key).length})
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <Link
            href="/admin/projects/new"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 text-xs text-white font-medium hover:bg-blue-500 transition-colors"
          >
            <PlusIcon className="w-3.5 h-3.5" /> New Job
          </Link>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-5">

        {/* Stat Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div
            onClick={() => { setStatusFilter("pending_review"); setPage(1); }}
            className="bg-[#1a1a1a] border border-white/8 rounded-xl p-4 flex items-center justify-between cursor-pointer hover:border-amber-400/30 transition-colors">
            <div>
              <p className="text-[10px] text-white/35 uppercase tracking-widest font-medium mb-1.5">Queue Status</p>
              <p className="text-2xl font-black text-white">{loading ? "—" : `${newCount} New Request${newCount !== 1 ? "s" : ""}`}</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-amber-400/10 border border-amber-400/20 flex items-center justify-center flex-shrink-0">
              <QueueIcon className="w-5 h-5 text-amber-400" />
            </div>
          </div>
          <div
            onClick={() => { setStatusFilter("in_review"); setPage(1); }}
            className="bg-[#1a1a1a] border border-white/8 rounded-xl p-4 flex items-center justify-between cursor-pointer hover:border-violet-400/30 transition-colors">
            <div>
              <p className="text-[10px] text-white/35 uppercase tracking-widest font-medium mb-1.5">Mapping Needed</p>
              <p className="text-2xl font-black text-white">{loading ? "—" : `${mappingCount} Pending`}</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-violet-400/10 border border-violet-400/20 flex items-center justify-center flex-shrink-0">
              <MapIcon className="w-5 h-5 text-violet-400" />
            </div>
          </div>
          <div
            onClick={() => { setStatusFilter("live"); setPage(1); }}
            className="bg-[#1a1a1a] border border-white/8 rounded-xl p-4 flex items-center justify-between cursor-pointer hover:border-green-400/30 transition-colors">
            <div>
              <p className="text-[10px] text-white/35 uppercase tracking-widest font-medium mb-1.5">Live Projects</p>
              <p className="text-2xl font-black text-white">{loading ? "—" : `${liveCount} Published`}</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-green-400/10 border border-green-400/20 flex items-center justify-center flex-shrink-0">
              <LiveIcon className="w-5 h-5 text-green-400" />
            </div>
          </div>
        </div>

        {/* Awaiting Payment */}
        {unpaidRequests.length > 0 && (
          <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl overflow-hidden mb-1">
            <div className="px-5 py-3 border-b border-amber-500/15 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-400" />
              <p className="text-xs font-bold text-amber-400 uppercase tracking-widest">Awaiting Payment ({unpaidRequests.length})</p>
            </div>
            <div className="divide-y divide-amber-500/10">
              {unpaidRequests.map(req => (
                <div key={req.id} className="flex items-center justify-between px-5 py-3">
                  <div>
                    <p className="text-sm font-semibold text-white">{req.project_name}</p>
                    <p className="text-[10px] text-white/35 mt-0.5">
                      {req.home_type?.replace(/_/g, " ")} · {req.beds}bd {req.baths}ba
                      {req.square_footage ? ` · ${req.square_footage.toLocaleString()} sqft` : ""}
                      {" · "}Submitted {new Date(req.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <button
                    onClick={() => handleDeleteRequest(req.id)}
                    disabled={deletingId === req.id}
                    className="flex items-center gap-1.5 text-[10px] px-2.5 py-1.5 rounded-lg border border-red-500/25 text-red-400 hover:bg-red-500/10 disabled:opacity-40 transition-colors"
                  >
                    {deletingId === req.id ? "Removing…" : "Remove"}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Filter tabs */}
        <div className="flex flex-wrap items-center gap-1">
          {[
            { key: "all",            label: "All" },
            { key: "pending_review", label: "New Requests" },
            { key: "in_review",      label: "Needs Mapping" },
            { key: "in_development", label: "In Progress" },
            { key: "live",           label: "Live" },
          ].map(f => (
            <button key={f.key} onClick={() => { setStatusFilter(f.key); setPage(1); }}
              className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${
                statusFilter === f.key
                  ? "bg-blue-600/20 text-blue-400 border border-blue-500/30"
                  : "text-white/40 hover:text-white"
              }`}>
              {f.label}
            </button>
          ))}
          <div className="ml-auto flex items-center gap-1.5 bg-white/5 border border-white/10 rounded-lg px-2.5 py-1.5">
            <SearchIcon className="w-3.5 h-3.5 text-white/25 flex-shrink-0" />
            <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
              placeholder="Search projects..."
              className="bg-transparent text-xs text-white/70 placeholder-white/25 w-32 sm:w-40 outline-none" />
          </div>
        </div>

        {/* Table */}
        <div className="bg-[#1a1a1a] border border-white/8 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
        <div className="min-w-[600px]">
          <div className="grid grid-cols-12 gap-4 px-5 py-3 text-[9px] font-bold uppercase tracking-widest text-white/25 border-b border-white/8">
            <div className="col-span-4">Project Name</div>
            <div className="col-span-3">Builder Client</div>
            <div className="col-span-2">Time in Stage</div>
            <div className="col-span-2">Status</div>
            <div className="col-span-1 text-right">Action</div>
          </div>

          {loading ? (
            <div className="divide-y divide-white/5">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="grid grid-cols-12 gap-4 px-5 py-4 animate-pulse">
                  <div className="col-span-4 h-9 bg-white/5 rounded-lg" />
                  <div className="col-span-3 h-4 bg-white/5 rounded" />
                  <div className="col-span-2 h-4 bg-white/5 rounded" />
                  <div className="col-span-2 h-5 bg-white/5 rounded-full" />
                  <div className="col-span-1 h-7 bg-white/5 rounded" />
                </div>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-20 text-center">
              <p className="text-white/25 text-sm">No projects match this filter</p>
              {activeFilters > 0 ? (
                <button
                  onClick={() => { setStatusFilter("all"); setBuilderFilter("all"); setSearch(""); }}
                  className="mt-3 inline-block text-xs text-blue-400 hover:underline">
                  Clear filters →
                </button>
              ) : (
                <Link href="/admin/projects/new" className="mt-3 inline-block text-xs text-blue-400 hover:underline">
                  Create your first project →
                </Link>
              )}
            </div>
          ) : (
            <div className="divide-y divide-white/5">
              {paged.map(project => {
                const tiq     = timeInQueue(project.updated_at);
                const status  = STATUS_MAP[project.status ?? "pending_review"];
                const builder = project.company_slug ? builders[project.company_slug] : null;
                return (
                  <div key={project.id} onClick={() => router.push(`/admin/requests/${project.id}`)} className="grid grid-cols-12 gap-4 items-center px-5 py-3.5 hover:bg-white/3 transition-colors cursor-pointer">
                    {/* Project */}
                    <div className="col-span-4 flex items-center gap-3">
                      {project.thumbnail_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={project.thumbnail_url} alt={project.name}
                          className="w-9 h-9 rounded-xl object-cover flex-shrink-0" />
                      ) : (
                        <div className="w-9 h-9 rounded-xl bg-[#111] border border-white/10 flex items-center justify-center flex-shrink-0">
                          <HouseIcon className="w-4 h-4 text-white/30" />
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-white truncate">{project.name}</p>
                        <p className="text-[10px] text-white/30 font-mono">ID: {shortId(project.id)}</p>
                      </div>
                    </div>

                    {/* Builder */}
                    <div className="col-span-3 flex items-center gap-2">
                      {builder?.logo_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={builder.logo_url} alt={builder.company_name}
                          className="w-5 h-5 rounded object-contain flex-shrink-0" />
                      ) : null}
                      <p className="text-xs text-white/65 truncate">
                        {builder?.company_name ?? (project.company_slug
                          ? project.company_slug.replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase())
                          : "—")}
                      </p>
                    </div>

                    {/* Time in stage */}
                    <div className="col-span-2">
                      {tiq.urgent ? (
                        <span className="flex items-center gap-1 text-xs font-semibold text-red-400">
                          ⚠ {tiq.label}
                        </span>
                      ) : (
                        <span className="text-xs text-white/50">{tiq.label}</span>
                      )}
                    </div>

                    {/* Status */}
                    <div className="col-span-2">
                      <span className={`text-[10px] font-bold px-2.5 py-1 rounded border ${status.style}`}>
                        {status.label}
                      </span>
                    </div>

                    {/* Action */}
                    <div className="col-span-1 flex justify-end">
                      {project.status === "pending_review" && (
                        <button
                          onClick={e => { e.preventDefault(); router.push(`/admin/requests/${project.id}`); }}
                          className="text-[10px] px-2.5 py-1.5 bg-amber-400/10 border border-amber-400/25 text-amber-400 font-medium rounded-lg hover:bg-amber-400/20 transition-colors whitespace-nowrap">
                          Review
                        </button>
                      )}
                      {(project.status === "in_development" || project.status === "in_review") && (
                        <button
                          onClick={e => { e.preventDefault(); router.push(`/admin/node-bridge?project=${project.id}`); }}
                          className="text-[10px] px-2.5 py-1.5 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-500 transition-colors whitespace-nowrap">
                          Node Bridge
                        </button>
                      )}
                      {project.status === "live" && project.slug && project.company_slug && (
                        <a href={`/project/${project.company_slug}/${project.slug}`}
                          target="_blank" rel="noreferrer"
                          onClick={e => e.stopPropagation()}
                          className="text-[10px] px-2.5 py-1.5 bg-green-600/20 text-green-400 font-medium rounded-lg hover:bg-green-600/30 transition-colors whitespace-nowrap border border-green-400/20">
                          Preview
                        </a>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>{/* min-w-[600px] */}
        </div>{/* overflow-x-auto */}
          {!loading && filtered.length > 0 && (
            <div className="flex items-center justify-between px-5 py-3.5 border-t border-white/8">
              <p className="text-xs text-white/30">
                Showing <strong className="text-white/50">{(page-1)*PER_PAGE+1}</strong> to{" "}
                <strong className="text-white/50">{Math.min(page*PER_PAGE, filtered.length)}</strong> of{" "}
                <strong className="text-white/50">{filtered.length}</strong> results
              </p>
              <div className="flex items-center gap-2">
                <button onClick={() => setPage(p => Math.max(1,p-1))} disabled={page===1}
                  className="text-xs px-3 py-1.5 border border-white/12 rounded-lg text-white/40 hover:text-white disabled:opacity-30 transition-colors">Previous</button>
                <button onClick={() => setPage(p => Math.min(totalPages,p+1))} disabled={page>=totalPages}
                  className="text-xs px-3 py-1.5 border border-white/12 rounded-lg text-white/40 hover:text-white disabled:opacity-30 transition-colors">Next</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function FilterIcon({ className }: { className?: string }) {
  return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 4h18M7 12h10M11 20h2"/></svg>;
}
function ExportIcon({ className }: { className?: string }) {
  return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>;
}
function PlusIcon({ className }: { className?: string }) {
  return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4"/></svg>;
}
function HouseIcon({ className }: { className?: string }) {
  return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/></svg>;
}
function QueueIcon({ className }: { className?: string }) {
  return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 10h16M4 14h10"/></svg>;
}
function MapIcon({ className }: { className?: string }) {
  return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"/></svg>;
}
function LiveIcon({ className }: { className?: string }) {
  return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><circle cx="12" cy="12" r="10"/><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3"/></svg>;
}
function SearchIcon({ className }: { className?: string }) {
  return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><circle cx="11" cy="11" r="8"/><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35"/></svg>;
}
