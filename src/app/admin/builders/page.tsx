"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { getAllBuilders } from "@/lib/admin-api";
import { Builder } from "@/types/database";

const PLAN_STYLE: Record<string, string> = {
  starter:    "text-white/50 bg-white/8 border-white/15",
  pro:        "text-blue-400 bg-blue-400/10 border-blue-400/25",
  enterprise: "text-violet-400 bg-violet-400/10 border-violet-400/25",
};
const STATUS_STYLE: Record<string, string> = {
  active:    "text-green-400 bg-green-400/10",
  inactive:  "text-white/30 bg-white/5",
  suspended: "text-red-400 bg-red-400/10",
  trial:     "text-amber-400 bg-amber-400/10",
};

function timeAgo(s: string) {
  const d = Date.now() - new Date(s).getTime();
  const m = Math.floor(d / 60000);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}
function initials(name: string) {
  return name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
}

const BG_COLORS = [
  "from-blue-600 to-blue-800",
  "from-violet-600 to-violet-800",
  "from-green-600 to-green-800",
  "from-amber-600 to-amber-800",
  "from-pink-600 to-pink-800",
];

export default function BuilderCRMPage() {
  const [builders, setBuilders] = useState<Builder[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [search,   setSearch]   = useState("");
  const [filter,   setFilter]   = useState<string>("all");

  useEffect(() => {
    getAllBuilders().then(data => {
      setBuilders(data);
      setLoading(false);
    });
  }, []);

  const filtered = useMemo(() => {
    return builders.filter(b => {
      const matchSearch = !search ||
        b.company_name.toLowerCase().includes(search.toLowerCase()) ||
        b.contact_email?.toLowerCase().includes(search.toLowerCase()) ||
        b.primary_contact_name?.toLowerCase().includes(search.toLowerCase());
      const matchFilter = filter === "all" || b.status === filter || b.plan_tier === filter;
      return matchSearch && matchFilter;
    });
  }, [builders, search, filter]);

  return (
    <div className="flex flex-col h-full overflow-hidden">

      {/* Header */}
      <div className="px-6 py-4 border-b border-white/8 flex-shrink-0 flex items-center justify-between">
        <div>
          <h1 className="text-base font-bold text-white">Builder CRM</h1>
          <p className="text-xs text-white/35 mt-0.5">Manage builder accounts, billing, and platform access.</p>
        </div>
        <div className="flex items-center gap-2">
          <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/12 text-xs text-white/50 hover:text-white hover:border-white/25 transition-colors">
            <FilterIcon className="w-3.5 h-3.5" /> Filter
          </button>
          <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/12 text-xs text-white/50 hover:text-white hover:border-white/25 transition-colors">
            <ExportIcon className="w-3.5 h-3.5" /> Export
          </button>
          <Link
            href="/admin/builders/new"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 text-xs text-white font-medium hover:bg-blue-500 transition-colors"
          >
            <PlusIcon className="w-3.5 h-3.5" /> Add New Builder
          </Link>
        </div>
      </div>

      {/* Filter bar */}
      <div className="px-6 py-3 border-b border-white/8 flex-shrink-0 flex items-center gap-3">
        <div className="flex items-center gap-1.5 bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 w-64">
          <SearchIcon className="w-3.5 h-3.5 text-white/25 flex-shrink-0" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search builders..."
            className="bg-transparent text-xs text-white/70 placeholder-white/25 flex-1 outline-none"
          />
        </div>
        {["all", "active", "trial", "pro", "enterprise"].map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors capitalize ${
              filter === f
                ? "bg-blue-600/20 text-blue-400 border border-blue-500/30"
                : "text-white/40 hover:text-white"
            }`}
          >
            {f === "all" ? "All Builders" : f}
          </button>
        ))}
        <span className="ml-auto text-xs text-white/30">{filtered.length} builders</span>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="p-6 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-16 bg-[#1a1a1a] border border-white/8 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <p className="text-white/20 text-4xl mb-3">🏗</p>
            <p className="text-sm text-white/40 font-medium">No builders found</p>
            {builders.length === 0 && (
              <p className="text-xs text-white/25 mt-1 max-w-xs">
                Run the SQL migration in{" "}
                <code className="text-white/40">supabase/builders_team.sql</code>{" "}
                then add your first builder.
              </p>
            )}
            <Link
              href="/admin/builders/new"
              className="mt-4 px-4 py-2 bg-blue-600 text-xs text-white rounded-lg hover:bg-blue-500 transition-colors"
            >
              Add First Builder
            </Link>
          </div>
        ) : (
          <div className="px-6 py-4 overflow-x-auto">
          <div className="min-w-[640px]">
            {/* Table header */}
            <div className="grid grid-cols-12 gap-4 px-4 py-2 text-[9px] font-bold uppercase tracking-widest text-white/25 border-b border-white/8 mb-1">
              <div className="col-span-3">Company</div>
              <div className="col-span-2">Contact</div>
              <div className="col-span-2">Plan</div>
              <div className="col-span-2">Projects</div>
              <div className="col-span-2">Client Since</div>
              <div className="col-span-1">Actions</div>
            </div>

            <div className="space-y-1">
              {filtered.map((b, idx) => (
                <Link
                  key={b.id}
                  href={`/admin/builders/${b.id}`}
                  className="grid grid-cols-12 gap-4 items-center px-4 py-3.5 rounded-xl hover:bg-white/4 transition-colors border border-transparent hover:border-white/8 group"
                >
                  {/* Company */}
                  <div className="col-span-3 flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${BG_COLORS[idx % BG_COLORS.length]} flex items-center justify-center flex-shrink-0`}>
                      <span className="text-xs font-bold text-white">{initials(b.company_name)}</span>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-white group-hover:text-blue-300 transition-colors">{b.company_name}</p>
                      {b.location && <p className="text-[10px] text-white/30">{b.location}</p>}
                    </div>
                  </div>

                  {/* Contact */}
                  <div className="col-span-2">
                    {b.primary_contact_name && (
                      <p className="text-xs text-white/70 truncate">{b.primary_contact_name}</p>
                    )}
                    {b.contact_email && (
                      <p className="text-[10px] text-white/30 truncate">{b.contact_email}</p>
                    )}
                  </div>

                  {/* Plan */}
                  <div className="col-span-2 flex items-center gap-2">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded border uppercase tracking-wide ${PLAN_STYLE[b.plan_tier]}`}>
                      {b.plan_tier}
                    </span>
                    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full capitalize ${STATUS_STYLE[b.status]}`}>
                      {b.status}
                    </span>
                  </div>

                  {/* Projects */}
                  <div className="col-span-2">
                    <p className="text-xs text-white/70">{b.active_projects_count} / {b.max_projects} active</p>
                    <div className="mt-1 w-full bg-white/6 rounded-full h-1">
                      <div
                        className="h-1 rounded-full bg-blue-500"
                        style={{ width: `${Math.min(100, (b.active_projects_count / b.max_projects) * 100)}%` }}
                      />
                    </div>
                  </div>

                  {/* Client Since */}
                  <div className="col-span-2">
                    <p className="text-xs text-white/50">
                      {new Date(b.client_since).toLocaleDateString("en-US", { month: "short", year: "numeric" })}
                    </p>
                    <p className="text-[10px] text-white/25">{timeAgo(b.client_since)}</p>
                  </div>

                  {/* Actions */}
                  <div className="col-span-1 flex items-center gap-1">
                    <button className="text-[10px] px-2 py-1 rounded-lg bg-white/6 text-white/50 hover:bg-white/10 hover:text-white transition-colors">
                      View
                    </button>
                  </div>
                </Link>
              ))}
            </div>
          </div>{/* min-w-[640px] */}
          </div>
        )}
      </div>
    </div>
  );
}

function FilterIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 4h18M7 12h10M11 20h2"/>
    </svg>
  );
}
function ExportIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
    </svg>
  );
}
function PlusIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4"/>
    </svg>
  );
}
function SearchIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <circle cx="11" cy="11" r="8"/><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35"/>
    </svg>
  );
}
