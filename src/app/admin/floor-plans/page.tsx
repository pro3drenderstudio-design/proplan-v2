"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { IMPERSONATE_KEY } from "@/lib/builder-api";

interface FloorPlanRow {
  id: string;
  name: string;
  beds: number | null;
  baths: number | null;
  floors: number | null;
  sqft: number | null;
  garage_spaces: number | null;
  base_price: number | null;
  thumbnail_url: string | null;
  home_style: string | null;
  project_id: string | null;
  is_active: boolean;
  builder_id: string;
  created_at: string;
  builders: { id: string; company_name: string; company_slug: string; logo_url: string | null };
}

function fmt(n: number) {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

export default function AdminFloorPlansPage() {
  const [plans,     setPlans]     = useState<FloorPlanRow[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [search,    setSearch]    = useState("");
  const [builderFilter, setBuilderFilter] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (search)        params.set("search", search);
    if (builderFilter) params.set("builderId", builderFilter);
    const res  = await fetch(`/api/admin/floor-plans?${params}`);
    const data = await res.json();
    setPlans(Array.isArray(data) ? data : []);
    setLoading(false);
  }, [search, builderFilter]);

  useEffect(() => { load(); }, [load]);

  // Unique builders for filter dropdown
  const builders = Array.from(
    new Map(plans.map(p => [p.builders.id, p.builders])).values()
  ).sort((a, b) => a.company_name.localeCompare(b.company_name));

  const grouped = builderFilter
    ? { [builderFilter]: plans }
    : plans.reduce<Record<string, FloorPlanRow[]>>((acc, p) => {
        const key = p.builders.id;
        if (!acc[key]) acc[key] = [];
        acc[key].push(p);
        return acc;
      }, {});

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 px-6 py-4 border-b border-white/8 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-base font-bold text-white">Floor Plans</h1>
          <p className="text-xs text-white/35 mt-0.5">{plans.length} plans across all builders</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-lg px-3 py-1.5">
            <svg className="w-3.5 h-3.5 text-white/25 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <circle cx="11" cy="11" r="8"/><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35"/>
            </svg>
            <input type="text" placeholder="Search plans..." value={search}
              onChange={e => setSearch(e.target.value)}
              className="bg-transparent text-xs text-white/70 placeholder-white/25 outline-none w-44" />
          </div>
          <select value={builderFilter} onChange={e => setBuilderFilter(e.target.value)}
            className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white/60 outline-none">
            <option value="">All Builders</option>
            {builders.map(b => (
              <option key={b.id} value={b.id}>{b.company_name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-6 py-5 space-y-8">
        {loading ? (
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="bg-white/4 border border-white/6 rounded-xl h-52 animate-pulse" />
            ))}
          </div>
        ) : plans.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <p className="text-white/25 text-sm">No floor plans found</p>
          </div>
        ) : (
          Object.entries(grouped).map(([builderId, bPlans]) => {
            const builderInfo = bPlans[0].builders;
            return (
              <div key={builderId}>
                {/* Builder header */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2.5">
                    {builderInfo.logo_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={builderInfo.logo_url} alt={builderInfo.company_name}
                        className="h-6 object-contain max-w-[80px]" />
                    ) : (
                      <div className="w-6 h-6 rounded bg-blue-600/30 flex items-center justify-center">
                        <span className="text-[9px] font-bold text-blue-300">
                          {builderInfo.company_name.slice(0, 2).toUpperCase()}
                        </span>
                      </div>
                    )}
                    <Link href={`/admin/builders/${builderInfo.id}`}
                      className="text-sm font-bold text-white hover:text-blue-400 transition-colors">
                      {builderInfo.company_name}
                    </Link>
                    <span className="text-[10px] text-white/25 bg-white/5 px-2 py-0.5 rounded-full">
                      {bPlans.length} plan{bPlans.length !== 1 ? "s" : ""}
                    </span>
                  </div>
                  <button
                    onClick={() => {
                      if (typeof window !== "undefined") window.localStorage.setItem(IMPERSONATE_KEY, builderInfo.id);
                      window.open("/builder/floor-plans", "_blank");
                    }}
                    className="text-[10px] text-amber-400/70 hover:text-amber-400 border border-amber-500/20 hover:border-amber-500/40 px-2.5 py-1 rounded-lg transition-colors">
                    Edit as Builder ↗
                  </button>
                </div>

                {/* Plan cards */}
                <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
                  {bPlans.map(fp => (
                    <div key={fp.id} className="bg-[#1a1a1a] border border-white/8 rounded-xl overflow-hidden hover:border-white/14 transition-colors">
                      {fp.thumbnail_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={fp.thumbnail_url} alt={fp.name} className="w-full h-28 object-cover" />
                      ) : (
                        <div className="w-full h-28 bg-white/3 flex items-center justify-center">
                          <svg className="w-7 h-7 text-white/8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
                          </svg>
                        </div>
                      )}
                      <div className="p-3">
                        <div className="flex items-start justify-between gap-1 mb-1.5">
                          <p className="text-xs font-bold text-white leading-tight">{fp.name}</p>
                          <div className="flex gap-1 flex-shrink-0">
                            {fp.project_id && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-blue-500/15 text-blue-400 border border-blue-500/25">3D</span>}
                            {!fp.is_active && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-white/5 text-white/30 border border-white/10">Off</span>}
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-1 mb-1.5">
                          {[
                            fp.beds    != null && `${fp.beds}bd`,
                            fp.baths   != null && `${fp.baths}ba`,
                            fp.sqft    != null && `${fp.sqft.toLocaleString()}sf`,
                            fp.garage_spaces != null && `${fp.garage_spaces}gar`,
                          ].filter(Boolean).map(s => (
                            <span key={s as string} className="text-[9px] text-white/35 bg-white/4 px-1 py-0.5 rounded">{s}</span>
                          ))}
                        </div>
                        {fp.base_price != null && (
                          <p className="text-[11px] font-bold text-white/60">{fmt(fp.base_price)}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
