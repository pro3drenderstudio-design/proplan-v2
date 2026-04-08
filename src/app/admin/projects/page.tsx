"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { getAllProjects, getCategoriesWithOptions } from "@/lib/admin-api";
import { Project } from "@/types/database";

const STATUS_STYLE: Record<string, { label: string; cls: string }> = {
  live:           { label: "Live",          cls: "text-green-400  bg-green-400/10 border-green-400/20"  },
  in_development: { label: "In Dev",        cls: "text-blue-400   bg-blue-400/10  border-blue-400/20"   },
  in_review:      { label: "In Review",     cls: "text-violet-400 bg-violet-400/10 border-violet-400/20"},
  pending_review: { label: "Pending",       cls: "text-amber-400  bg-amber-400/10  border-amber-400/20" },
  archived:       { label: "Archived",      cls: "text-white/25   bg-white/5       border-white/10"     },
};

function statusInfo(s: string) {
  return STATUS_STYLE[s] ?? { label: s, cls: "text-white/40 bg-white/5 border-white/10" };
}

interface ProjectRow extends Project {
  categoryCount?: number;
  optionCount?:   number;
  healthy?:       boolean;
  issues?:        string[];
}

export default function AdminProjectsPage() {
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [search,   setSearch]   = useState("");
  const [filter,   setFilter]   = useState<string>("all");
  const [detail,   setDetail]   = useState<ProjectRow | null>(null);

  useEffect(() => {
    (async () => {
      const all = await getAllProjects();
      // Quick health check per project — load categories concurrently
      const rows: ProjectRow[] = await Promise.all(
        all.map(async p => {
          const cats = await getCategoriesWithOptions(p.id);
          const optCount = cats.reduce((s, c) => s + c.options.length, 0);
          const issues: string[] = [];
          if (!p.sketchfab_uid) issues.push("No Sketchfab UID");
          if (cats.length === 0)  issues.push("No categories");
          if (optCount === 0)     issues.push("No options");
          if (!p.thumbnail_url)   issues.push("No thumbnail");
          // Check for options missing node mappings
          const unmapped = cats.flatMap(c => c.options).filter(o => !o.node_list || o.node_list.length === 0);
          if (unmapped.length > 0) issues.push(`${unmapped.length} unmapped option${unmapped.length > 1 ? "s" : ""}`);
          return { ...p, categoryCount: cats.length, optionCount: optCount, healthy: issues.length === 0, issues };
        })
      );
      setProjects(rows);
      setLoading(false);
    })();
  }, []);

  const filtered = useMemo(() => {
    return projects.filter(p => {
      if (filter !== "all" && p.status !== filter) return false;
      if (search && !p.name.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [projects, search, filter]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: projects.length };
    Object.keys(STATUS_STYLE).forEach(s => { c[s] = projects.filter(p => p.status === s).length; });
    c.issues = projects.filter(p => !p.healthy).length;
    return c;
  }, [projects]);

  return (
    <div className="flex h-full overflow-hidden">
      {/* Main list */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-white/8 flex-shrink-0 flex items-center justify-between">
          <div>
            <h1 className="text-base font-bold text-white">Models Registry</h1>
            <p className="text-xs text-white/35 mt-0.5">{projects.length} total models</p>
          </div>
          <div className="relative">
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search models…"
              className="bg-[#252525] border border-white/15 rounded-lg pl-8 pr-3 py-1.5 text-sm text-white placeholder:text-white/25 focus:outline-none focus:border-blue-500/50 w-52"
            />
            <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
            </svg>
          </div>
        </div>

        {/* Filter tabs */}
        <div className="flex items-center gap-1 px-6 py-2.5 border-b border-white/8 flex-shrink-0 overflow-x-auto">
          {[
            { key: "all",    label: "All"       },
            { key: "live",   label: "Live"      },
            { key: "in_development", label: "In Dev" },
            { key: "in_review",      label: "In Review" },
            { key: "pending_review", label: "Pending" },
            { key: "issues", label: "⚠ Issues" },
          ].map(f => (
            <button key={f.key} onClick={() => setFilter(f.key)}
              className={`px-2.5 py-1 rounded text-xs font-medium whitespace-nowrap transition-colors ${
                filter === f.key
                  ? "bg-blue-600 text-white"
                  : "text-white/40 hover:text-white hover:bg-white/8"
              }`}>
              {f.label}
              <span className="ml-1 opacity-60">({counts[f.key] ?? 0})</span>
            </button>
          ))}
        </div>

        {/* Table */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="p-6 space-y-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-14 bg-white/4 rounded-lg animate-pulse" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex items-center justify-center h-40 text-white/25 text-sm">
              No models match filters
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-[#161616] border-b border-white/8">
                <tr>
                  {["Model", "Status", "Categories", "Options", "Sketchfab", "Health", ""].map(h => (
                    <th key={h} className="text-left px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-white/30 whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filtered.map(p => {
                  const s = statusInfo(p.status ?? "");
                  const isDetail = detail?.id === p.id;
                  return (
                    <tr key={p.id}
                      onClick={() => setDetail(isDetail ? null : p)}
                      className={`cursor-pointer transition-colors ${isDetail ? "bg-blue-600/10" : "hover:bg-white/4"}`}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          {p.thumbnail_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={p.thumbnail_url} alt="" className="w-9 h-7 rounded object-cover flex-shrink-0" />
                          ) : (
                            <div className="w-9 h-7 rounded bg-white/8 flex-shrink-0" />
                          )}
                          <div>
                            <p className="font-medium text-white">{p.name}</p>
                            <p className="text-xs text-white/30">{p.slug ?? p.id.slice(0, 8)}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${s.cls}`}>
                          {s.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-white/60 tabular-nums">{p.categoryCount ?? "—"}</td>
                      <td className="px-4 py-3 text-white/60 tabular-nums">{p.optionCount ?? "—"}</td>
                      <td className="px-4 py-3">
                        {p.sketchfab_uid
                          ? <span className="font-mono text-[10px] text-white/40">{p.sketchfab_uid.slice(0, 12)}…</span>
                          : <span className="text-xs text-red-400/70">Missing</span>}
                      </td>
                      <td className="px-4 py-3">
                        {p.healthy
                          ? <span className="text-xs text-green-400">✓ Healthy</span>
                          : <span className="text-xs text-amber-400">⚠ {p.issues?.length} issue{p.issues?.length !== 1 ? "s" : ""}</span>}
                      </td>
                      <td className="px-4 py-3">
                        <Link href={`/admin/node-bridge?project=${p.id}`}
                          onClick={e => e.stopPropagation()}
                          className="text-xs text-white/30 hover:text-blue-400 transition-colors whitespace-nowrap">
                          Node Bridge →
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Detail drawer */}
      {detail && (
        <div className="w-72 flex-shrink-0 border-l border-white/8 bg-[#161616] flex flex-col overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/8 flex-shrink-0">
            <p className="text-sm font-semibold text-white truncate">{detail.name}</p>
            <button onClick={() => setDetail(null)} className="text-white/30 hover:text-white ml-2 flex-shrink-0">×</button>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {/* Thumbnail */}
            <div className="w-full h-28 rounded-lg overflow-hidden bg-white/6">
              {detail.thumbnail_url
                // eslint-disable-next-line @next/next/no-img-element
                ? <img src={detail.thumbnail_url} alt="" className="w-full h-full object-cover" />
                : <div className="w-full h-full flex items-center justify-center text-white/20 text-xs">No thumbnail</div>}
            </div>

            {/* Fields */}
            <dl className="space-y-2 text-xs">
              {[
                { label: "Status",        value: statusInfo(detail.status ?? "").label },
                { label: "Sketchfab UID", value: detail.sketchfab_uid || "—" },
                { label: "Base Price",    value: detail.base_price ? `$${detail.base_price.toLocaleString()}` : "—" },
                { label: "Type",          value: detail.home_type ?? "—" },
                { label: "Beds/Baths",    value: `${detail.beds ?? "—"} bd / ${detail.baths ?? "—"} ba` },
                { label: "Categories",    value: String(detail.categoryCount ?? "—") },
                { label: "Options",       value: String(detail.optionCount ?? "—") },
                { label: "Created",       value: new Date(detail.created_at).toLocaleDateString() },
              ].map(r => (
                <div key={r.label} className="flex justify-between gap-2">
                  <dt className="text-white/35 flex-shrink-0">{r.label}</dt>
                  <dd className="text-white/70 text-right font-mono truncate">{r.value}</dd>
                </div>
              ))}
            </dl>

            {/* Issues */}
            {detail.issues && detail.issues.length > 0 && (
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-amber-400/60 mb-1.5">Issues</p>
                <ul className="space-y-1">
                  {detail.issues.map(issue => (
                    <li key={issue} className="flex items-start gap-1.5 text-xs text-amber-400/80">
                      <span className="mt-px">⚠</span> {issue}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Actions */}
            <div className="space-y-2 pt-2">
              <Link href={`/admin/projects/${detail.id}`}
                className="w-full flex items-center justify-center py-2 rounded-lg bg-violet-600/20 border border-violet-500/30 text-violet-400 text-sm font-medium hover:bg-violet-600/30 transition-colors">
                Edit Categories &amp; Options →
              </Link>
              <Link href={`/admin/node-bridge?project=${detail.id}`}
                className="w-full flex items-center justify-center py-2 rounded-lg bg-blue-600/20 border border-blue-500/30 text-blue-400 text-sm font-medium hover:bg-blue-600/30 transition-colors">
                Open Node Bridge →
              </Link>
              <Link href={`/builder/projects/${detail.id}`}
                className="w-full flex items-center justify-center py-2 rounded-lg bg-white/6 border border-white/10 text-white/60 text-sm font-medium hover:bg-white/10 transition-colors">
                View in Builder
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
