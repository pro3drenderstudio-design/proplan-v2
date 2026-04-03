"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getBuilderCommunities, getBuilderProfile, getBuilderProjects } from "@/lib/builder-api";
import { Project } from "@/types/database";

interface CommunityStats {
  id: string; name: string; slug: string; description: string | null;
  site_map_url: string | null; company_slug: string | null;
  lot_count: number; available: number; reserved: number; sold: number;
}

interface BuilderProfile {
  company_slug: string; company_name: string;
  logo_url: string | null; contact_email: string | null;
}

const EMPTY_FORM = { name: "", slug: "", description: "" };

function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function LotBar({ available, reserved, sold, total }: { available: number; reserved: number; sold: number; total: number }) {
  if (total === 0) return <p className="text-xs text-white/20">No lots defined</p>;
  return (
    <div className="space-y-1.5">
      <div className="flex h-1.5 rounded-full overflow-hidden gap-px">
        {available > 0 && <div className="bg-green-500/70 rounded-full" style={{ flex: available }} />}
        {reserved  > 0 && <div className="bg-amber-400/70 rounded-full" style={{ flex: reserved  }} />}
        {sold      > 0 && <div className="bg-white/15 rounded-full"     style={{ flex: sold      }} />}
      </div>
      <div className="flex items-center gap-3">
        <span className="flex items-center gap-1 text-[10px] text-white/40"><span className="w-1.5 h-1.5 rounded-full bg-green-500/70" />{available} available</span>
        {reserved > 0 && <span className="flex items-center gap-1 text-[10px] text-white/40"><span className="w-1.5 h-1.5 rounded-full bg-amber-400/70" />{reserved} reserved</span>}
        {sold     > 0 && <span className="flex items-center gap-1 text-[10px] text-white/40"><span className="w-1.5 h-1.5 rounded-full bg-white/25" />{sold} sold</span>}
      </div>
    </div>
  );
}

export default function BuilderCommunitiesPage() {
  const [communities, setCommunities] = useState<CommunityStats[]>([]);
  const [profile,     setProfile]     = useState<BuilderProfile | null>(null);
  const [loading,     setLoading]     = useState(true);

  // New community modal
  const [showNew,   setShowNew]   = useState(false);
  const [form,      setForm]      = useState(EMPTY_FORM);
  const [creating,  setCreating]  = useState(false);
  const [createErr, setCreateErr] = useState<string | null>(null);

  // Request design slide-over
  const [showRequest,  setShowRequest]  = useState(false);
  const [projects,     setProjects]     = useState<Project[]>([]);
  const [reqForm,      setReqForm]      = useState({
    community_name: "", location: "", lot_count: "", phases: "1",
    style_notes: "", reference_links: [""], model_ids: [] as string[], notes: "",
  });
  const [submitting,  setSubmitting]  = useState(false);
  const [reqSuccess,  setReqSuccess]  = useState(false);

  // Copied link state
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([getBuilderCommunities(), getBuilderProfile(), getBuilderProjects()]).then(([c, p, projs]) => {
      setCommunities(c);
      setProfile(p);
      setProjects(projs);
      setLoading(false);
    });
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!profile) return;
    setCreating(true); setCreateErr(null);
    const res = await fetch("/api/communities", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, company_slug: profile.company_slug }),
    });
    const json = await res.json().catch(() => ({}));
    if (res.ok) {
      setCommunities(prev => [{ ...json, lot_count: 0, available: 0, reserved: 0, sold: 0 }, ...prev]);
      setShowNew(false); setForm(EMPTY_FORM);
    } else {
      setCreateErr(json?.error ?? "Something went wrong.");
    }
    setCreating(false);
  }

  async function handleRequest(e: React.FormEvent) {
    e.preventDefault();
    if (!profile) return;
    setSubmitting(true);
    await fetch("/api/community-design-requests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...reqForm, company_slug: profile.company_slug }),
    });
    setSubmitting(false);
    setReqSuccess(true);
  }

  function copyLink(c: CommunityStats) {
    const url = `${window.location.origin}/community/${c.company_slug}/${c.slug}`;
    navigator.clipboard.writeText(url);
    setCopiedId(c.id);
    setTimeout(() => setCopiedId(null), 2000);
  }

  const totalLots      = communities.reduce((s, c) => s + c.lot_count, 0);
  const totalAvailable = communities.reduce((s, c) => s + c.available, 0);

  return (
    <div className="p-8 max-w-7xl mx-auto">

      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight" style={{ fontFamily: "var(--font-syne), sans-serif" }}>
            Communities
          </h1>
          <p className="text-sm text-white/30 mt-0.5">Manage interactive site maps and lot availability for your communities.</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowRequest(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-white/12 text-white/50 text-sm font-medium hover:text-white hover:border-white/25 transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
            </svg>
            Request Design
          </button>
          <button onClick={() => setShowNew(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold transition-colors shadow-lg shadow-blue-600/20">
            <span className="text-base leading-none">+</span> New Community
          </button>
        </div>
      </div>

      {/* Stats */}
      {!loading && communities.length > 0 && (
        <div className="grid grid-cols-3 gap-3 mb-6">
          {[
            { label: "Communities",     value: communities.length, color: "text-white"       },
            { label: "Total Lots",      value: totalLots,          color: "text-white"       },
            { label: "Available Lots",  value: totalAvailable,     color: "text-green-400"   },
          ].map(s => (
            <div key={s.label} className="bg-[#0e0e0e] rounded-2xl border border-white/8 px-5 py-4">
              <p className="text-[10px] text-white/25 uppercase tracking-widest font-semibold">{s.label}</p>
              <p className={`text-3xl font-extrabold mt-1 ${s.color}`} style={{ fontFamily: "var(--font-syne), sans-serif" }}>
                {s.value}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => <div key={i} className="h-72 bg-white/4 rounded-2xl animate-pulse" />)}
        </div>
      ) : communities.length === 0 ? (
        <div className="bg-[#0e0e0e] border border-white/8 rounded-2xl py-20 text-center">
          <div className="w-16 h-16 rounded-2xl bg-white/4 border border-white/8 flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-white/15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 6.75V15m6-6v8.25m.503 3.498l4.875-2.437c.381-.19.622-.58.622-1.006V4.82c0-.836-.88-1.38-1.628-1.006l-3.869 1.934c-.317.159-.69.159-1.006 0L9.503 3.252a1.125 1.125 0 00-1.006 0L3.622 5.689C3.24 5.88 3 6.695V19.18c0 .836.88 1.38 1.628 1.006l3.869-1.934c.317-.159.69-.159 1.006 0l4.994 2.497c.317.158.69.158 1.006 0z" />
            </svg>
          </div>
          <h3 className="text-white/50 font-semibold text-base mb-1">No communities yet</h3>
          <p className="text-white/25 text-sm mb-6 max-w-xs mx-auto">Upload a site plan and mark your lots — or let us design it for you.</p>
          <div className="flex items-center justify-center gap-3">
            <button onClick={() => setShowNew(true)}
              className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold transition-colors">
              Create community
            </button>
            <button onClick={() => setShowRequest(true)}
              className="px-4 py-2 rounded-xl border border-white/12 text-white/50 text-sm font-medium hover:text-white hover:border-white/20 transition-colors">
              Request design →
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {communities.map(c => (
            <div key={c.id} className="group bg-[#0e0e0e] border border-white/8 rounded-2xl overflow-hidden hover:border-white/18 transition-colors">
              {/* Map thumbnail */}
              <div className="relative h-40 bg-[#080808] overflow-hidden">
                {c.site_map_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={c.site_map_url} alt={c.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center gap-2">
                    <div className="absolute inset-0 blueprint-grid opacity-30" />
                    <svg className="w-10 h-10 text-white/10 relative z-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 6.75V15m6-6v8.25m.503 3.498l4.875-2.437c.381-.19.622-.58.622-1.006V4.82c0-.836-.88-1.38-1.628-1.006l-3.869 1.934c-.317.159-.69.159-1.006 0L9.503 3.252a1.125 1.125 0 00-1.006 0L3.622 5.689C3.24 5.88 3 6.695V19.18c0 .836.88 1.38 1.628 1.006l3.869-1.934c.317-.159.69-.159 1.006 0l4.994 2.497c.317.158.69.158 1.006 0z" />
                    </svg>
                    <p className="text-[10px] text-white/20 relative z-10">No site map yet</p>
                  </div>
                )}
                {/* Lot count badge */}
                {c.lot_count > 0 && (
                  <div className="absolute top-2.5 right-2.5 px-2 py-0.5 rounded-full text-[10px] font-bold text-white/70"
                    style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(8px)", border: "1px solid rgba(255,255,255,0.1)" }}>
                    {c.lot_count} lots
                  </div>
                )}
              </div>

              {/* Card body */}
              <div className="p-4">
                <h3 className="font-bold text-white/85 text-sm leading-tight group-hover:text-white transition-colors" style={{ fontFamily: "var(--font-syne), sans-serif" }}>
                  {c.name}
                </h3>
                {c.description ? (
                  <p className="text-xs text-white/30 mt-1 line-clamp-2 leading-relaxed">{c.description}</p>
                ) : (
                  <p className="text-xs text-white/15 mt-1 italic">No description</p>
                )}

                {/* Lot availability bar */}
                <div className="mt-3">
                  <LotBar available={c.available} reserved={c.reserved} sold={c.sold} total={c.lot_count} />
                </div>

                {/* Actions */}
                <div className="flex items-center justify-between mt-4 pt-3.5 border-t border-white/6">
                  <button onClick={() => copyLink(c)}
                    className="flex items-center gap-1.5 text-xs text-white/30 hover:text-white/60 transition-colors">
                    {copiedId === c.id ? (
                      <>
                        <svg className="w-3.5 h-3.5 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                        </svg>
                        <span className="text-green-400">Copied!</span>
                      </>
                    ) : (
                      <>
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
                        </svg>
                        Share link
                      </>
                    )}
                  </button>
                  <Link href={`/builder/communities/${c.id}`}
                    className="flex items-center gap-1 text-xs text-blue-400 font-medium hover:text-blue-300 transition-colors">
                    Edit map →
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── New community modal ── */}
      {showNew && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="w-full max-w-md bg-[#0e0e0e] border border-white/12 rounded-2xl shadow-2xl p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-sm font-bold text-white">New Community</h2>
              <button onClick={() => { setShowNew(false); setCreateErr(null); }} className="text-white/30 hover:text-white text-lg leading-none">×</button>
            </div>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-widest text-white/30 mb-1.5">Community Name</label>
                <input required value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value, slug: slugify(e.target.value) }))}
                  className="w-full bg-[#141414] border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white/80 focus:outline-none focus:border-blue-500/60 transition-colors"
                  placeholder="Oakwood Reserve" />
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-widest text-white/30 mb-1.5">URL Slug</label>
                <input required value={form.slug}
                  onChange={e => setForm(f => ({ ...f, slug: slugify(e.target.value) }))}
                  className="w-full bg-[#141414] border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white/80 font-mono focus:outline-none focus:border-blue-500/60 transition-colors"
                  placeholder="oakwood-reserve" />
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-widest text-white/30 mb-1.5">Description (optional)</label>
                <textarea value={form.description} rows={2}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  className="w-full bg-[#141414] border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white/80 focus:outline-none focus:border-blue-500/60 transition-colors resize-none"
                  placeholder="A peaceful neighborhood of 42 single-family homes…" />
              </div>
              {createErr && <p className="text-xs text-red-400 bg-red-400/8 border border-red-400/20 rounded-lg px-3 py-2">{createErr}</p>}
              <div className="flex gap-2 pt-1">
                <button type="button" onClick={() => { setShowNew(false); setCreateErr(null); }}
                  className="flex-1 py-2.5 rounded-xl border border-white/10 text-sm text-white/40 hover:text-white transition-colors">Cancel</button>
                <button type="submit" disabled={creating}
                  className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-sm text-white font-semibold transition-colors disabled:opacity-50">
                  {creating ? "Creating…" : "Create"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Request design slide-over ── */}
      {showRequest && (
        <div className="fixed inset-0 z-50 flex">
          <div className="flex-1 bg-black/60 backdrop-blur-sm" onClick={() => { if (!submitting) { setShowRequest(false); setReqSuccess(false); } }} />
          <div className="w-[520px] bg-[#0a0a0a] border-l border-white/8 shadow-2xl flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-6 py-5 border-b border-white/8 flex-shrink-0">
              <div>
                <h2 className="font-bold text-white text-lg" style={{ fontFamily: "var(--font-syne), sans-serif" }}>Request Community Design</h2>
                <p className="text-xs text-white/30 mt-0.5">Our team will build out your interactive site map.</p>
              </div>
              <button onClick={() => { setShowRequest(false); setReqSuccess(false); }} className="text-white/25 hover:text-white/60 text-xl leading-none transition-colors">×</button>
            </div>

            {reqSuccess ? (
              <div className="flex-1 flex flex-col items-center justify-center gap-4 p-8 text-center">
                <div className="w-16 h-16 rounded-2xl bg-emerald-500/12 border border-emerald-500/20 flex items-center justify-center">
                  <svg className="w-8 h-8 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <p className="font-bold text-white text-xl" style={{ fontFamily: "var(--font-syne), sans-serif" }}>Request Submitted</p>
                  <p className="text-white/40 text-sm mt-2 leading-relaxed max-w-xs">Our team will review your request and reach out within 1–2 business days to discuss your community design.</p>
                </div>
                <button onClick={() => { setShowRequest(false); setReqSuccess(false); }}
                  className="mt-2 px-5 py-2.5 rounded-xl bg-white/8 border border-white/12 text-sm text-white/60 hover:text-white transition-colors">Done</button>
              </div>
            ) : (
              <form onSubmit={handleRequest} className="flex-1 flex flex-col overflow-hidden">
                <div className="flex-1 overflow-y-auto p-6 space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="col-span-2">
                      <label className="block text-[10px] font-bold uppercase tracking-widest text-white/30 mb-1.5">Community Name *</label>
                      <input required value={reqForm.community_name}
                        onChange={e => setReqForm(f => ({ ...f, community_name: e.target.value }))}
                        placeholder="e.g. Willow Creek Estates"
                        className="w-full bg-[#141414] border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white/80 focus:outline-none focus:border-blue-500/60 transition-colors" />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-widest text-white/30 mb-1.5">Location</label>
                      <input value={reqForm.location}
                        onChange={e => setReqForm(f => ({ ...f, location: e.target.value }))}
                        placeholder="City, State"
                        className="w-full bg-[#141414] border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white/80 focus:outline-none focus:border-blue-500/60 transition-colors" />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-widest text-white/30 mb-1.5">Approx. Lots</label>
                      <input type="number" min={1} value={reqForm.lot_count}
                        onChange={e => setReqForm(f => ({ ...f, lot_count: e.target.value }))}
                        placeholder="42"
                        className="w-full bg-[#141414] border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white/80 focus:outline-none focus:border-blue-500/60 transition-colors" />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-widest text-white/30 mb-1.5">Number of Phases</label>
                      <select value={reqForm.phases}
                        onChange={e => setReqForm(f => ({ ...f, phases: e.target.value }))}
                        className="w-full bg-[#141414] border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white/70 focus:outline-none focus:border-blue-500/60 transition-colors">
                        {["1", "2", "3", "4", "5+"].map(p => <option key={p} value={p}>Phase {p}</option>)}
                      </select>
                    </div>
                    {projects.length > 0 && (
                      <div className="col-span-2">
                        <label className="block text-[10px] font-bold uppercase tracking-widest text-white/30 mb-1.5">Home Models to Include</label>
                        <div className="space-y-1.5 max-h-36 overflow-y-auto">
                          {projects.map(p => (
                            <label key={p.id} className="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-white/3 hover:bg-white/6 cursor-pointer border border-transparent hover:border-white/8 transition-colors">
                              <input type="checkbox"
                                checked={reqForm.model_ids.includes(p.id)}
                                onChange={e => setReqForm(f => ({
                                  ...f,
                                  model_ids: e.target.checked
                                    ? [...f.model_ids, p.id]
                                    : f.model_ids.filter(id => id !== p.id),
                                }))}
                                className="accent-blue-500 flex-shrink-0" />
                              <span className="text-sm text-white/60">{p.name}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    )}
                    <div className="col-span-2">
                      <label className="block text-[10px] font-bold uppercase tracking-widest text-white/30 mb-1.5">Style & Theme Notes</label>
                      <textarea value={reqForm.style_notes} rows={3}
                        onChange={e => setReqForm(f => ({ ...f, style_notes: e.target.value }))}
                        placeholder="Modern farmhouse aesthetic, wooded lots along the north side, cul-de-sac at the end…"
                        className="w-full bg-[#141414] border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white/80 focus:outline-none focus:border-blue-500/60 transition-colors resize-none" />
                    </div>
                    <div className="col-span-2">
                      <label className="block text-[10px] font-bold uppercase tracking-widest text-white/30 mb-1.5">Reference Links (site plans, inspiration)</label>
                      {reqForm.reference_links.map((link, i) => (
                        <div key={i} className="flex gap-2 mb-2">
                          <input value={link}
                            onChange={e => setReqForm(f => ({ ...f, reference_links: f.reference_links.map((l, j) => j === i ? e.target.value : l) }))}
                            placeholder="https://…"
                            className="flex-1 bg-[#141414] border border-white/10 rounded-xl px-3 py-2 text-sm text-white/70 font-mono focus:outline-none focus:border-blue-500/60 transition-colors" />
                          {reqForm.reference_links.length > 1 && (
                            <button type="button" onClick={() => setReqForm(f => ({ ...f, reference_links: f.reference_links.filter((_, j) => j !== i) }))}
                              className="text-white/20 hover:text-red-400 text-sm transition-colors px-1">✕</button>
                          )}
                        </div>
                      ))}
                      <button type="button"
                        onClick={() => setReqForm(f => ({ ...f, reference_links: [...f.reference_links, ""] }))}
                        className="text-xs text-blue-400 hover:text-blue-300 transition-colors">+ Add link</button>
                    </div>
                    <div className="col-span-2">
                      <label className="block text-[10px] font-bold uppercase tracking-widest text-white/30 mb-1.5">Additional Notes</label>
                      <textarea value={reqForm.notes} rows={2}
                        onChange={e => setReqForm(f => ({ ...f, notes: e.target.value }))}
                        placeholder="Any other details, timeline requirements, or special requests…"
                        className="w-full bg-[#141414] border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white/80 focus:outline-none focus:border-blue-500/60 transition-colors resize-none" />
                    </div>
                  </div>
                </div>
                <div className="px-6 py-4 border-t border-white/8 flex gap-3 flex-shrink-0">
                  <button type="button" onClick={() => setShowRequest(false)}
                    className="px-4 py-2.5 rounded-xl border border-white/10 text-sm text-white/40 hover:text-white/70 hover:bg-white/5 transition-colors">Cancel</button>
                  <button type="submit" disabled={submitting || !reqForm.community_name}
                    className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-semibold transition-colors shadow-lg shadow-blue-600/20">
                    {submitting ? "Submitting…" : "Submit Request"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
