"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getAllCommunities, getAllBuildersBySlug } from "@/lib/admin-api";
import { Community, Builder } from "@/types/database";

type CommunityRow = Community & { lot_count: number };

export default function CommunitiesPage() {
  const [communities, setCommunities] = useState<CommunityRow[]>([]);
  const [builders,    setBuilders]    = useState<Record<string, Builder>>({});
  const [loading,     setLoading]     = useState(true);
  const [showNew,     setShowNew]     = useState(false);
  const [form,        setForm]        = useState({ name: "", slug: "", company_slug: "", description: "" });
  const [creating,    setCreating]    = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([getAllCommunities(), getAllBuildersBySlug()]).then(([c, b]) => {
      setCommunities(c);
      setBuilders(b);
      setLoading(false);
    });
  }, []);

  function slugify(s: string) {
    return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    setCreateError(null);
    const res = await fetch("/api/communities", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const json = await res.json().catch(() => ({}));
    if (res.ok) {
      setCommunities(prev => [...prev, { ...(json as CommunityRow), lot_count: 0 }]);
      setShowNew(false);
      setForm({ name: "", slug: "", company_slug: "", description: "" });
    } else {
      setCreateError(json?.error ?? "Something went wrong. Please try again.");
    }
    setCreating(false);
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="px-6 py-4 border-b border-white/8 flex-shrink-0 flex items-center justify-between">
        <div>
          <h1 className="text-base font-bold text-white">Site Maps</h1>
          <p className="text-xs text-white/35 mt-0.5">Interactive community maps with clickable lots</p>
        </div>
        <button
          onClick={() => setShowNew(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 text-xs text-white font-medium hover:bg-blue-500 transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          New Community
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-5">
        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-16 bg-white/4 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : communities.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 gap-3 text-center">
            <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center">
              <MapIcon className="w-6 h-6 text-white/20" />
            </div>
            <p className="text-white/40 text-sm">No communities yet</p>
            <button onClick={() => setShowNew(true)} className="text-xs text-blue-400 hover:underline">
              Create your first community →
            </button>
          </div>
        ) : (
          <div className="bg-[#1a1a1a] border border-white/8 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
          <div className="min-w-[520px]">
            <div className="grid grid-cols-12 gap-4 px-5 py-3 text-[9px] font-bold uppercase tracking-widest text-white/25 border-b border-white/8">
              <div className="col-span-4">Community</div>
              <div className="col-span-3">Builder</div>
              <div className="col-span-2">Lots</div>
              <div className="col-span-2">Site Map</div>
              <div className="col-span-1" />
            </div>
            <div className="divide-y divide-white/5">
              {communities.map(c => {
                const builder = c.company_slug ? builders[c.company_slug] : null;
                return (
                  <div key={c.id} className="grid grid-cols-12 gap-4 items-center px-5 py-3.5 hover:bg-white/3 transition-colors">
                    <div className="col-span-4">
                      <p className="text-sm font-semibold text-white">{c.name}</p>
                      <p className="text-[10px] text-white/30 font-mono">{c.slug}</p>
                    </div>
                    <div className="col-span-3 text-xs text-white/50">
                      {builder?.company_name ?? c.company_slug ?? "—"}
                    </div>
                    <div className="col-span-2 text-xs text-white/50">{c.lot_count} lots</div>
                    <div className="col-span-2">
                      {c.site_map_url ? (
                        <span className="text-xs text-green-400 flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-green-400" /> Uploaded
                        </span>
                      ) : (
                        <span className="text-xs text-white/25">No image</span>
                      )}
                    </div>
                    <div className="col-span-1 flex justify-end">
                      <Link href={`/admin/communities/${c.id}`}
                        className="text-xs text-blue-400 hover:text-blue-300 transition-colors">
                        Edit →
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>{/* min-w */}
          </div>{/* overflow-x-auto */}
          </div>
        )}
      </div>

      {/* New community modal */}
      {showNew && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="w-full max-w-md bg-[#1a1a1a] border border-white/12 rounded-2xl shadow-2xl p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-sm font-bold text-white">New Community</h2>
              <button onClick={() => setShowNew(false)} className="text-white/30 hover:text-white text-lg leading-none">×</button>
            </div>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-widest text-white/30 mb-1.5">Community Name</label>
                <input required value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value, slug: slugify(e.target.value) }))}
                  className="w-full bg-[#111] border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white/80 focus:outline-none focus:border-blue-500/60 transition-colors"
                  placeholder="Oakwood Reserve" />
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-widest text-white/30 mb-1.5">URL Slug</label>
                <input required value={form.slug}
                  onChange={e => setForm(f => ({ ...f, slug: slugify(e.target.value) }))}
                  className="w-full bg-[#111] border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white/80 font-mono focus:outline-none focus:border-blue-500/60 transition-colors"
                  placeholder="oakwood-reserve" />
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-widest text-white/30 mb-1.5">Builder</label>
                <select value={form.company_slug}
                  onChange={e => setForm(f => ({ ...f, company_slug: e.target.value }))}
                  className="w-full bg-[#111] border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white/80 focus:outline-none focus:border-blue-500/60 transition-colors">
                  <option value="">Select a builder…</option>
                  {Object.entries(builders).map(([slug, b]) => (
                    <option key={slug} value={slug}>{b.company_name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-widest text-white/30 mb-1.5">Description (optional)</label>
                <textarea value={form.description} rows={2}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  className="w-full bg-[#111] border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white/80 focus:outline-none focus:border-blue-500/60 transition-colors resize-none" />
              </div>
              {createError && (
                <p className="text-xs text-red-400 bg-red-400/8 border border-red-400/20 rounded-lg px-3 py-2">{createError}</p>
              )}
              <div className="flex gap-2 pt-1">
                <button type="button" onClick={() => { setShowNew(false); setCreateError(null); }}
                  className="flex-1 py-2.5 rounded-xl border border-white/10 text-sm text-white/40 hover:text-white transition-colors">
                  Cancel
                </button>
                <button type="submit" disabled={creating}
                  className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-sm text-white font-semibold transition-colors disabled:opacity-50">
                  {creating ? "Creating…" : "Create"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function MapIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 6.75V15m6-6v8.25m.503 3.498l4.875-2.437c.381-.19.622-.58.622-1.006V4.82c0-.836-.88-1.38-1.628-1.006l-3.869 1.934c-.317.159-.69.159-1.006 0L9.503 3.252a1.125 1.125 0 00-1.006 0L3.622 5.689C3.24 5.88 3 6.27 3 6.695V19.18c0 .836.88 1.38 1.628 1.006l3.869-1.934c.317-.159.69-.159 1.006 0l4.994 2.497c.317.158.69.158 1.006 0z" />
    </svg>
  );
}
