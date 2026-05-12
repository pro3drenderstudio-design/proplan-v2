"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getBuilderCommunities, getBuilderProfile } from "@/lib/builder-api";
import { SiteMapRequest } from "@/types/database";

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

  // Copied link state
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Site map request flow
  const [activeTab,   setActiveTab]   = useState<"communities" | "requests">("communities");
  const [siteMapReqs, setSiteMapReqs] = useState<SiteMapRequest[]>([]);
  const [smSetupFee,  setSmSetupFee]  = useState<number | null>(null);
  const [showSmReq,    setShowSmReq]    = useState(false);
  const [smReqForm,    setSmReqForm]    = useState({ community_name: "", community_address: "", estimated_lot_count: "", phases: "1", style_notes: "", target_date: "" });
  const [smFiles,      setSmFiles]      = useState<{ name: string; url: string; size: number }[]>([]);
  const [smLinks,      setSmLinks]      = useState<string[]>([""]);
  const [smUploading,  setSmUploading]  = useState(false);
  const [smSubmitting, setSmSubmitting] = useState(false);
  const [smErr,        setSmErr]        = useState("");

  useEffect(() => {
    Promise.all([
      getBuilderCommunities(),
      getBuilderProfile(),
      fetch("/api/site-map-requests").then(r => r.ok ? r.json() : []).catch(() => []),
      fetch("/api/addons?slug=site-maps").then(r => r.ok ? r.json() : null).catch(() => null),
    ]).then(([c, p, smrs, addon]) => {
      setCommunities(c);
      setProfile(p);
      setSiteMapReqs(Array.isArray(smrs) ? smrs : (smrs?.data ?? []));
      if (addon?.setup_fee_cents) setSmSetupFee(addon.setup_fee_cents);
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

  async function handleSmFileUpload(files: FileList) {
    setSmUploading(true);
    const uploaded: { name: string; url: string; size: number }[] = [];
    for (const file of Array.from(files)) {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/site-map-requests/upload", { method: "POST", body: fd });
      if (res.ok) {
        const data = await res.json() as { url: string; name: string; size: number };
        uploaded.push(data);
      }
    }
    setSmFiles(prev => [...prev, ...uploaded]);
    setSmUploading(false);
  }

  async function handleSmReq(e: React.FormEvent) {
    e.preventDefault();
    if (!profile) return;
    setSmSubmitting(true);
    setSmErr("");
    try {
      // Create the site map request
      const res = await fetch("/api/site-map-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          community_name:       smReqForm.community_name,
          community_address:    smReqForm.community_address || null,
          estimated_lot_count:  smReqForm.estimated_lot_count ? parseInt(smReqForm.estimated_lot_count, 10) : null,
          phases:               parseInt(smReqForm.phases, 10),
          style_notes:          smReqForm.style_notes || null,
          target_date:          smReqForm.target_date || null,
          plat_map_files:       smFiles.length > 0 ? smFiles : undefined,
          reference_links:      smLinks.filter(l => l.trim()),
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error((j as { error?: string }).error ?? "Failed to submit request");
      }
      const { id: requestId } = await res.json() as { id: string };
      setSmFiles([]); setSmLinks([""]);

      // Redirect to Stripe for setup fee payment
      const checkoutRes = await fetch("/api/stripe/sitemap-setup-fee", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId }),
      });
      if (!checkoutRes.ok) throw new Error("Failed to create checkout session");
      const { url } = await checkoutRes.json() as { url: string };
      window.location.href = url;
    } catch (err) {
      setSmErr(err instanceof Error ? err.message : "Something went wrong");
      setSmSubmitting(false);
    }
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
    <div className="p-4 md:p-8 max-w-7xl mx-auto">

      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-6 flex-wrap">
        <div className="min-w-0">
          <h1 className="text-2xl font-extrabold text-white tracking-tight" style={{ fontFamily: "var(--font-syne), sans-serif" }}>
            Communities
          </h1>
          <p className="text-sm text-white/30 mt-0.5 hidden sm:block">Manage interactive site maps and lot availability for your communities.</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button onClick={() => { setShowSmReq(true); setSmErr(""); setSmFiles([]); setSmLinks([""]); }}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-blue-500/30 text-blue-400 text-sm font-medium hover:bg-blue-500/10 hover:border-blue-400/50 transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 6.75V15m6-6v8.25m.503 3.498l4.875-2.437c.381-.19.622-.58.622-1.006V4.82c0-.836-.88-1.38-1.628-1.006l-3.869 1.934c-.317.159-.69.159-1.006 0L9.503 3.252a1.125 1.125 0 00-1.006 0L3.622 5.689C3.24 5.88 3 6.695V19.18c0 .836.88 1.38 1.628 1.006l3.869-1.934c.317-.159.69-.159 1.006 0l4.994 2.497c.317.158.69.158 1.006 0z" />
            </svg>
            Request Site Map
          </button>
          <button onClick={() => setShowNew(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold transition-colors shadow-lg shadow-blue-600/20">
            <span className="text-base leading-none">+</span> New Community
          </button>
        </div>
      </div>

      {/* Tab switcher */}
      <div className="flex gap-1 mb-6 p-1 rounded-xl w-fit" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
        {([
          { key: "communities" as const, label: "Communities", count: communities.length },
          { key: "requests"    as const, label: "Site Map Requests", count: siteMapReqs.length },
        ] as const).map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all"
            style={activeTab === tab.key
              ? { background: "rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.9)" }
              : { color: "rgba(255,255,255,0.35)" }}>
            {tab.label}
            {tab.count > 0 && (
              <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold"
                style={activeTab === tab.key
                  ? { background: "rgba(59,130,246,0.25)", color: "rgba(147,197,253,1)" }
                  : { background: "rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.3)" }}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── Requests tab ─────────────────────────────────────────────────────── */}
      {activeTab === "requests" && (
        <div>
          {siteMapReqs.length === 0 ? (
            <div className="bg-[#0e0e0e] border border-white/8 rounded-2xl py-16 text-center">
              <div className="w-14 h-14 rounded-2xl bg-white/4 border border-white/8 flex items-center justify-center mx-auto mb-4">
                <svg className="w-7 h-7 text-white/15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 6.75V15m6-6v8.25m.503 3.498l4.875-2.437c.381-.19.622-.58.622-1.006V4.82c0-.836-.88-1.38-1.628-1.006l-3.869 1.934c-.317.159-.69.159-1.006 0L9.503 3.252a1.125 1.125 0 00-1.006 0L3.622 5.689C3.24 5.88 3 6.695V19.18c0 .836.88 1.38 1.628 1.006l3.869-1.934c.317-.159.69-.159 1.006 0l4.994 2.497c.317.158.69.158 1.006 0z" />
                </svg>
              </div>
              <h3 className="text-white/50 font-semibold text-base mb-1">No site map requests</h3>
              <p className="text-white/25 text-sm mb-6 max-w-xs mx-auto">Request a new interactive site map for your community and our team will build it out.</p>
              <button onClick={() => { setShowSmReq(true); setSmErr(""); }}
                className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold transition-colors">
                Request Site Map
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {siteMapReqs.map(req => {
                const statusConfig: Record<string, { label: string; dot: string; bg: string; border: string }> = {
                  awaiting_payment: { label: "Awaiting Payment", dot: "#fbbf24", bg: "rgba(251,191,36,0.08)", border: "rgba(251,191,36,0.2)" },
                  pending_review:   { label: "Pending Review",   dot: "#60a5fa", bg: "rgba(96,165,250,0.08)", border: "rgba(96,165,250,0.2)" },
                  in_progress:      { label: "In Progress",      dot: "#a78bfa", bg: "rgba(167,139,250,0.08)", border: "rgba(167,139,250,0.2)" },
                  complete:         { label: "Complete",          dot: "#34d399", bg: "rgba(52,211,153,0.08)", border: "rgba(52,211,153,0.2)" },
                  archived:         { label: "Archived",          dot: "#6b7280", bg: "rgba(107,114,128,0.06)", border: "rgba(107,114,128,0.15)" },
                };
                const s = statusConfig[req.status] ?? statusConfig.pending_review;
                return (
                  <div key={req.id} className="bg-[#0e0e0e] border border-white/8 rounded-2xl px-5 py-4 flex items-center justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold text-white/85 text-sm" style={{ fontFamily: "var(--font-syne), sans-serif" }}>{req.community_name}</h3>
                        <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold flex-shrink-0"
                          style={{ background: s.bg, border: `1px solid ${s.border}`, color: s.dot }}>
                          <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: s.dot }} />
                          {s.label}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 mt-1 flex-wrap">
                        {req.community_address && <span className="text-xs text-white/30">{req.community_address}</span>}
                        {req.estimated_lot_count && <span className="text-xs text-white/25">{req.estimated_lot_count} lots</span>}
                        {req.phases > 1 && <span className="text-xs text-white/25">{req.phases} phases</span>}
                        <span className="text-xs text-white/20">{new Date(req.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
                      </div>
                    </div>
                    <div className="flex-shrink-0 text-right">
                      <p className="text-xs text-white/25">Setup fee</p>
                      <p className="text-sm font-bold text-white/60">${(req.setup_fee_cents / 100).toLocaleString()}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Communities tab ───────────────────────────────────────────────────── */}
      {activeTab === "communities" && <>

      {/* Stats */}
      {!loading && communities.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
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
            <button onClick={() => { setShowSmReq(true); setSmErr(""); setSmFiles([]); setSmLinks([""]); }}
              className="px-4 py-2 rounded-xl border border-white/12 text-white/50 text-sm font-medium hover:text-white hover:border-white/20 transition-colors">
              Request site map →
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

      </> /* end communities tab */}

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

      {/* ── Site map request slide-over ── */}
      {showSmReq && (
        <div className="fixed inset-0 z-50 flex">
          <div className="flex-1 bg-black/60 backdrop-blur-sm" onClick={() => { if (!smSubmitting) setShowSmReq(false); }} />
          <div className="w-full sm:w-[520px] bg-[#0a0a0a] border-l border-white/8 shadow-2xl flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-6 py-5 border-b border-white/8 flex-shrink-0">
              <div>
                <h2 className="font-bold text-white text-lg" style={{ fontFamily: "var(--font-syne), sans-serif" }}>Request Interactive Site Map</h2>
                <p className="text-xs text-white/30 mt-0.5">Our team will build your interactive plat map. Setup fee applies.</p>
              </div>
              <button onClick={() => setShowSmReq(false)} className="text-white/25 hover:text-white/60 text-xl leading-none transition-colors">×</button>
            </div>
            <form onSubmit={handleSmReq} className="flex-1 flex flex-col overflow-hidden">
              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                {/* Setup fee callout */}
                {smSetupFee !== null && (
                  <div className="rounded-xl px-4 py-3.5 flex items-center gap-3" style={{ background: "rgba(59,130,246,0.07)", border: "1px solid rgba(59,130,246,0.2)" }}>
                    <svg className="w-5 h-5 text-blue-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75" />
                    </svg>
                    <div>
                      <p className="text-sm font-semibold text-white/80">One-time setup fee: <span className="text-blue-400">${(smSetupFee / 100).toLocaleString()}</span></p>
                      <p className="text-xs text-white/35 mt-0.5">You will be redirected to checkout after submitting this form.</p>
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-white/30 mb-1.5">Community Name *</label>
                  <input required value={smReqForm.community_name}
                    onChange={e => setSmReqForm(f => ({ ...f, community_name: e.target.value }))}
                    placeholder="e.g. Willow Creek Estates"
                    className="w-full bg-[#141414] border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white/80 focus:outline-none focus:border-blue-500/60 transition-colors" />
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-white/30 mb-1.5">Community Address</label>
                  <input value={smReqForm.community_address}
                    onChange={e => setSmReqForm(f => ({ ...f, community_address: e.target.value }))}
                    placeholder="123 Main St, Austin, TX 78701"
                    className="w-full bg-[#141414] border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white/80 focus:outline-none focus:border-blue-500/60 transition-colors" />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-widest text-white/30 mb-1.5">Estimated Lots</label>
                    <input type="number" min={1} value={smReqForm.estimated_lot_count}
                      onChange={e => setSmReqForm(f => ({ ...f, estimated_lot_count: e.target.value }))}
                      placeholder="42"
                      className="w-full bg-[#141414] border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white/80 focus:outline-none focus:border-blue-500/60 transition-colors" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-widest text-white/30 mb-1.5">Phases</label>
                    <select value={smReqForm.phases}
                      onChange={e => setSmReqForm(f => ({ ...f, phases: e.target.value }))}
                      className="w-full bg-[#141414] border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white/70 focus:outline-none focus:border-blue-500/60 transition-colors">
                      {["1", "2", "3", "4", "5"].map(p => <option key={p} value={p}>{p} phase{p !== "1" ? "s" : ""}</option>)}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-white/30 mb-1.5">Target Go-Live Date</label>
                  <input type="date" value={smReqForm.target_date}
                    onChange={e => setSmReqForm(f => ({ ...f, target_date: e.target.value }))}
                    className="w-full bg-[#141414] border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white/80 focus:outline-none focus:border-blue-500/60 transition-colors" />
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-white/30 mb-1.5">Style Notes</label>
                  <textarea value={smReqForm.style_notes} rows={3}
                    onChange={e => setSmReqForm(f => ({ ...f, style_notes: e.target.value }))}
                    placeholder="Modern aesthetic, wooded lots along the north side, custom lot numbering format…"
                    className="w-full bg-[#141414] border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white/80 focus:outline-none focus:border-blue-500/60 transition-colors resize-none" />
                </div>

                {/* File upload */}
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-white/30 mb-1.5">Plat Maps & Reference Files</label>
                  <label className={`flex flex-col items-center justify-center gap-2 w-full py-5 rounded-xl border-2 border-dashed cursor-pointer transition-colors
                    ${smUploading ? "opacity-50 cursor-not-allowed border-white/10" : "border-white/15 hover:border-blue-500/50 hover:bg-blue-500/5"}`}>
                    <svg className="w-6 h-6 text-white/30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                    </svg>
                    <span className="text-xs text-white/40">{smUploading ? "Uploading…" : "Click to upload PDF or images"}</span>
                    <span className="text-[10px] text-white/20">PDF, JPG, PNG, TIFF · up to 30 MB each</span>
                    <input type="file" multiple accept=".pdf,.jpg,.jpeg,.png,.webp,.tiff" className="hidden"
                      disabled={smUploading}
                      onChange={e => { if (e.target.files?.length) handleSmFileUpload(e.target.files); }} />
                  </label>
                  {smFiles.length > 0 && (
                    <div className="mt-2 space-y-1.5">
                      {smFiles.map((f, i) => (
                        <div key={i} className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
                          <svg className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                          </svg>
                          <span className="text-xs text-white/60 flex-1 truncate">{f.name}</span>
                          <button type="button" onClick={() => setSmFiles(prev => prev.filter((_, j) => j !== i))}
                            className="text-white/25 hover:text-red-400 transition-colors text-sm leading-none">×</button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Reference links */}
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-white/30 mb-1.5">Reference Links <span className="text-white/20 normal-case font-normal">(optional)</span></label>
                  <div className="space-y-2">
                    {smLinks.map((link, i) => (
                      <div key={i} className="flex gap-2">
                        <input type="url" value={link} placeholder="https://example.com/plat-map"
                          onChange={e => setSmLinks(prev => prev.map((l, j) => j === i ? e.target.value : l))}
                          className="flex-1 bg-[#141414] border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white/80 focus:outline-none focus:border-blue-500/60 transition-colors" />
                        {smLinks.length > 1 && (
                          <button type="button" onClick={() => setSmLinks(prev => prev.filter((_, j) => j !== i))}
                            className="px-2.5 py-2 rounded-xl border border-white/10 text-white/30 hover:text-red-400 transition-colors text-sm">×</button>
                        )}
                      </div>
                    ))}
                    <button type="button" onClick={() => setSmLinks(prev => [...prev, ""])}
                      className="text-xs text-blue-400 hover:text-blue-300 transition-colors">+ Add another link</button>
                  </div>
                </div>

                {smErr && <p className="text-xs text-red-400 bg-red-400/8 border border-red-400/20 rounded-lg px-3 py-2">{smErr}</p>}
              </div>

              <div className="px-6 py-4 border-t border-white/8 flex gap-3 flex-shrink-0">
                <button type="button" onClick={() => setShowSmReq(false)} disabled={smSubmitting}
                  className="px-4 py-2.5 rounded-xl border border-white/10 text-sm text-white/40 hover:text-white/70 hover:bg-white/5 transition-colors">Cancel</button>
                <button type="submit" disabled={smSubmitting || !smReqForm.community_name}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-semibold transition-colors shadow-lg shadow-blue-600/20">
                  {smSubmitting ? (
                    <>
                      <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                      </svg>
                      Redirecting to checkout…
                    </>
                  ) : "Continue to Payment →"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
