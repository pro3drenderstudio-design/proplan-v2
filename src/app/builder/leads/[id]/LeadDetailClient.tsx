"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  getLeadById,
  getBuilderProjects,
  getProjectCategoriesWithOptions,
  updateLeadStatus,
  updateLeadNotes,
  Lead,
  LeadStatus,
} from "@/lib/builder-api";
import { Project, CategoryWithOptions } from "@/types/database";

const STATUS_OPTIONS: { value: LeadStatus; label: string; color: string; dot: string }[] = [
  { value: "new",       label: "New",       color: "bg-blue-500/12 text-blue-400 border border-blue-500/20",      dot: "bg-blue-400"    },
  { value: "contacted", label: "Contacted", color: "bg-amber-500/12 text-amber-400 border border-amber-500/20",   dot: "bg-amber-400"   },
  { value: "qualified", label: "Qualified", color: "bg-violet-500/12 text-violet-400 border border-violet-500/20",dot: "bg-violet-400"  },
  { value: "converted", label: "Converted", color: "bg-emerald-500/12 text-emerald-400 border border-emerald-500/20",dot: "bg-emerald-400"},
  { value: "lost",      label: "Lost",      color: "bg-white/5 text-white/25 border border-white/8",              dot: "bg-white/20"    },
];

function fmt(n: number) {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}
function fmtDate(s: string, opts?: Intl.DateTimeFormatOptions) {
  return new Date(s).toLocaleDateString("en-US", opts ?? { month: "short", day: "numeric", year: "numeric" });
}
function fmtTime(s: string) {
  return new Date(s).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
}

interface ConfigLine {
  categoryName: string;
  optionName:   string;
  price:        number;
}

export default function LeadDetailClient({ id }: { id: string }) {
  const [lead,        setLead]        = useState<Lead | null>(null);
  const [project,     setProject]     = useState<Project | null>(null);
  const [categories,  setCategories]  = useState<CategoryWithOptions[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [notes,       setNotes]       = useState("");
  const [savingNotes, setSavingNotes] = useState(false);
  const [notesSaved,  setNotesSaved]  = useState(false);
  const [toast,       setToast]       = useState("");

  useEffect(() => {
    (async () => {
      const l = await getLeadById(id);
      if (!l) { setLoading(false); return; }
      setLead(l);
      setNotes(l.notes ?? "");

      const [projects] = await Promise.all([getBuilderProjects()]);
      const proj = l.project_id ? projects.find(p => p.id === l.project_id) ?? null : null;
      setProject(proj);

      if (proj) {
        const cats = await getProjectCategoriesWithOptions(proj.id);
        setCategories(cats);
      }
      setLoading(false);
    })();
  }, [id]);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(""), 3000);
  }

  async function handleStatusChange(status: LeadStatus) {
    if (!lead) return;
    const ok = await updateLeadStatus(lead.id, status);
    if (ok) setLead(prev => prev ? { ...prev, status } : null);
  }

  async function handleSaveNotes() {
    if (!lead) return;
    setSavingNotes(true);
    const ok = await updateLeadNotes(lead.id, notes);
    setSavingNotes(false);
    if (ok) {
      setLead(prev => prev ? { ...prev, notes } : null);
      setNotesSaved(true);
      setTimeout(() => setNotesSaved(false), 2000);
    }
  }

  const configLines: ConfigLine[] = (() => {
    if (!lead || !categories.length) return [];
    return Object.entries(lead.configuration).flatMap(([catId, optId]) => {
      const cat = categories.find(c => c.id === catId);
      const opt = cat?.options.find(o => o.id === String(optId));
      if (!cat || !opt) return [];
      return [{ categoryName: cat.name, optionName: opt.friendly_name, price: opt.price_impact ?? 0 }];
    });
  })();

  const optionsTotal = configLines.reduce((s, l) => s + l.price, 0);
  const basePrice    = project?.base_price ?? 0;
  const totalQuoted  = lead?.total_value ?? (basePrice + optionsTotal);

  const statusOpt = STATUS_OPTIONS.find(s => s.value === lead?.status) ?? STATUS_OPTIONS[0];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!lead) {
    return (
      <div className="p-8 text-center text-white/30">
        Lead not found. <Link href="/builder/leads" className="text-blue-400 hover:text-blue-300 underline">Back to leads</Link>
      </div>
    );
  }

  const initials = `${lead.first_name?.[0] ?? ""}${lead.last_name?.[0] ?? ""}`;

  return (
    <div className="min-h-screen bg-[#080808]">
      {/* Toast */}
      {toast && (
        <div className="fixed top-4 right-4 z-50 bg-[#141414] border border-white/10 text-white/80 text-sm px-4 py-2.5 rounded-xl shadow-xl">
          {toast}
        </div>
      )}

      {/* ── Hero Header ── */}
      <div className="relative bg-[#0a0a0a] border-b border-white/8 px-8 py-6 overflow-hidden">
        <div className="absolute inset-0 blueprint-grid opacity-10" />
        <div className="absolute inset-0 bg-gradient-to-r from-blue-600/5 via-transparent to-transparent" />
        <div className="relative">
          {/* Breadcrumb */}
          <div className="flex items-center gap-2 text-sm text-white/30 mb-5">
            <Link href="/builder/leads" className="hover:text-white/60 transition-colors">Leads</Link>
            <span>/</span>
            <span className="text-white/60">{lead.first_name} {lead.last_name}</span>
          </div>

          <div className="flex items-start justify-between gap-6 flex-wrap">
            {/* Lead identity */}
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-600 to-violet-600 flex items-center justify-center text-white font-bold text-lg flex-shrink-0 shadow-xl shadow-blue-600/20">
                {initials}
              </div>
              <div>
                <div className="flex items-center gap-2.5 mb-1.5">
                  <h1
                    className="text-xl font-extrabold text-white"
                    style={{ fontFamily: "var(--font-syne), sans-serif" }}
                  >
                    {lead.first_name} {lead.last_name}
                  </h1>
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold ${statusOpt.color}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${statusOpt.dot}`} />
                    {statusOpt.label.toUpperCase()}
                  </span>
                </div>
                <div className="flex items-center gap-4 text-sm text-white/35">
                  <span className="flex items-center gap-1.5">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                    {lead.email}
                  </span>
                  {lead.phone && (
                    <span className="flex items-center gap-1.5">
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                      </svg>
                      {lead.phone}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-2 flex-wrap">
              <a
                href={`mailto:${lead.email}?subject=Your ${project?.name ?? "Home"} Configuration`}
                className="flex items-center gap-2 px-4 py-2 rounded-xl border border-white/10 text-white/50 text-sm font-medium hover:text-white/80 hover:bg-white/5 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                Email Prospect
              </a>

              <div className="relative">
                <select
                  value={lead.status}
                  onChange={e => handleStatusChange(e.target.value as LeadStatus)}
                  className="appearance-none pl-3 pr-8 py-2 rounded-xl bg-white/6 border border-white/12 text-white/70 text-sm font-medium focus:outline-none focus:ring-1 focus:ring-blue-500/60 cursor-pointer"
                >
                  {STATUS_OPTIONS.map(o => (
                    <option key={o.value} value={o.value} className="text-white bg-[#141414]">{o.label}</option>
                  ))}
                </select>
                <svg className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Body ── */}
      <div className="px-8 py-6 max-w-7xl mx-auto grid grid-cols-3 gap-6">

        {/* ── LEFT 2/3 ── */}
        <div className="col-span-2 space-y-5">

          {/* Model Card */}
          {project && (
            <div className="bg-[#0e0e0e] rounded-2xl border border-white/8 overflow-hidden flex">
              <div className="relative w-52 h-40 flex-shrink-0">
                {project.thumbnail_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={project.thumbnail_url} alt={project.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-[#141414] relative flex items-center justify-center">
                    <div className="absolute inset-0 blueprint-grid opacity-30" />
                    <svg viewBox="0 0 24 24" fill="none" stroke="rgba(59,130,246,0.25)" strokeWidth="0.8" className="w-14 h-14 relative z-10">
                      <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>
                      <polyline points="9 22 9 12 15 12 15 22"/>
                    </svg>
                  </div>
                )}
                <div className="absolute bottom-2 left-2 bg-black/60 text-white/60 text-xs px-2 py-0.5 rounded font-mono backdrop-blur-sm">
                  {project.slug ?? project.id.slice(0, 8).toUpperCase()}
                </div>
              </div>

              <div className="flex-1 p-5">
                <div className="flex items-start justify-between mb-1">
                  <div>
                    <p className="text-[10px] font-semibold text-white/25 uppercase tracking-widest mb-0.5">Base Model</p>
                    <h2
                      className="text-lg font-bold text-white/80"
                      style={{ fontFamily: "var(--font-syne), sans-serif" }}
                    >
                      {project.name}
                    </h2>
                  </div>
                  <p
                    className="text-lg font-bold text-white/70"
                    style={{ fontFamily: "var(--font-syne), sans-serif" }}
                  >
                    {fmt(project.base_price ?? 0)}
                  </p>
                </div>
                {project.description && (
                  <p className="text-sm text-white/40 mb-3 line-clamp-2">{project.description}</p>
                )}
                <div className="flex items-center gap-4 text-sm text-white/35">
                  {project.beds   && <span><span className="font-semibold text-white/60">{project.beds}</span> Bed</span>}
                  {project.baths  && <span><span className="font-semibold text-white/60">{project.baths}</span> Bath</span>}
                  {project.floors && <span><span className="font-semibold text-white/60">{project.floors}</span> {project.floors === 1 ? "Story" : "Stories"}</span>}
                  {project.sqft   && <span><span className="font-semibold text-white/60">{project.sqft.toLocaleString()}</span> sqft</span>}
                </div>
              </div>
            </div>
          )}

          {/* Selected Upgrades */}
          <div className="bg-[#0e0e0e] rounded-2xl border border-white/8 overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/6">
              <h3
                className="font-bold text-white/80 text-sm"
                style={{ fontFamily: "var(--font-syne), sans-serif" }}
              >
                Selected Upgrades &amp; Customizations
              </h3>
              {project && (
                <Link href={`/builder/projects/${project.id}`}
                  className="text-blue-400 text-xs font-medium hover:text-blue-300 transition-colors">
                  Edit Config →
                </Link>
              )}
            </div>

            {configLines.length === 0 ? (
              <div className="px-5 py-8 text-center text-white/25 text-sm">
                {Object.keys(lead.configuration).length === 0
                  ? "No customizations selected."
                  : "Loading configuration details…"}
              </div>
            ) : (
              <>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/6 bg-white/3">
                      <th className="text-left px-5 py-2.5 text-[10px] font-semibold text-white/25 uppercase tracking-widest">Item Description</th>
                      <th className="text-left px-5 py-2.5 text-[10px] font-semibold text-white/25 uppercase tracking-widest">Category</th>
                      <th className="text-right px-5 py-2.5 text-[10px] font-semibold text-white/25 uppercase tracking-widest">Added Cost</th>
                    </tr>
                  </thead>
                </table>
                <div className="max-h-72 overflow-y-auto">
                  <table className="w-full text-sm">
                    <tbody className="divide-y divide-white/5">
                      {configLines.map((line, i) => (
                        <tr key={i} className="hover:bg-white/3 transition-colors">
                          <td className="px-5 py-3">
                            <p className="font-medium text-white/70">{line.optionName}</p>
                          </td>
                          <td className="px-5 py-3">
                            <span className="inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-500/12 text-blue-400 border border-blue-500/20">
                              {line.categoryName}
                            </span>
                          </td>
                          <td className="px-5 py-3 text-right font-semibold text-blue-400">
                            +{fmt(line.price)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="flex justify-between items-center px-5 py-3.5 border-t border-white/6 bg-white/3">
                  <span className="text-xs font-semibold text-white/30 uppercase tracking-widest">Total Options</span>
                  <span className="text-sm font-bold text-blue-400">+{fmt(optionsTotal)}</span>
                </div>
              </>
            )}
          </div>
        </div>

        {/* ── RIGHT 1/3 ── */}
        <div className="space-y-5">

          {/* Total Quoted Price */}
          <div className="bg-[#0e0e0e] rounded-2xl border border-white/8 p-5">
            <p className="text-[10px] font-semibold text-white/25 uppercase tracking-widest mb-1">Total Quoted Price</p>
            <p
              className="text-4xl font-black text-white tracking-tight mb-4"
              style={{ fontFamily: "var(--font-syne), sans-serif" }}
            >
              {fmt(totalQuoted)}
            </p>
            <div className="space-y-2.5 text-sm border-t border-white/6 pt-4">
              <div className="flex justify-between text-white/40">
                <span>Base Price</span>
                <span className="font-semibold text-white/70">{fmt(basePrice)}</span>
              </div>
              <div className="flex justify-between text-white/40">
                <span>Options Total</span>
                <span className="font-semibold text-blue-400">+{fmt(optionsTotal)}</span>
              </div>
              <div className="flex justify-between text-white/30">
                <span>Lot Premium</span>
                <span className="italic text-white/20">Included</span>
              </div>
            </div>
            <div className="flex items-center justify-between mt-4 pt-3 border-t border-white/6">
              <span className="text-xs text-white/25">
                Submitted {fmtDate(lead.created_at, { month: "short", day: "numeric" })}
              </span>
            </div>
          </div>

          {/* Deal Context */}
          <div className="bg-[#0e0e0e] rounded-2xl border border-white/8 p-5">
            <p className="text-[10px] font-semibold text-white/25 uppercase tracking-widest mb-4">Deal Context</p>
            <div className="space-y-0">
              {[
                { label: "Lead Created",         detail: `${fmtDate(lead.created_at)} at ${fmtTime(lead.created_at)} via Web Form`, active: true },
                { label: "Configuration Saved",  detail: fmtDate(lead.created_at),     active: true },
                { label: "Status",               detail: statusOpt.label,               active: lead.status !== "new" },
                { label: "Last Updated",         detail: fmtDate(lead.updated_at),      active: lead.updated_at !== lead.created_at },
              ].map((item, i, arr) => (
                <div key={i} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 mt-0.5 ${item.active ? "bg-blue-500" : "bg-white/10"}`} />
                    {i < arr.length - 1 && <div className="w-px flex-1 bg-white/6 my-1" />}
                  </div>
                  <div className="pb-3">
                    <p className="text-sm font-semibold text-white/60">{item.label}</p>
                    <p className="text-xs text-white/30">{item.detail}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Internal Notes */}
          <div className="bg-[#0e0e0e] rounded-2xl border border-white/8 p-5">
            <p className="text-[10px] font-semibold text-white/25 uppercase tracking-widest mb-3">Internal Notes</p>
            <textarea
              rows={4}
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder={`"Client is very interested in…"`}
              className="w-full bg-[#141414] border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white/60 italic resize-none focus:outline-none focus:ring-1 focus:ring-blue-500/60 focus:border-blue-500/40 placeholder:not-italic placeholder:text-white/20 mb-3 transition-colors"
            />
            <button
              onClick={handleSaveNotes}
              disabled={savingNotes}
              className={`w-full py-2 rounded-xl text-sm font-semibold transition-colors shadow-lg ${
                notesSaved
                  ? "bg-emerald-600 text-white shadow-emerald-600/20"
                  : "bg-blue-600 hover:bg-blue-500 text-white disabled:opacity-50 shadow-blue-600/20"
              }`}
            >
              {savingNotes ? "Saving…" : notesSaved ? "Saved ✓" : "Save Notes"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
