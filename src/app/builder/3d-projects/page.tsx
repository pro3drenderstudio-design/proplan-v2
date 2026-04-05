"use client";

import { useEffect, useState, useRef, Suspense } from "react";
import { useRouter } from "next/navigation";
import {
  getRenderRequests,
  createRenderRequest,
  requestRenderRevision,
  getBuilderProjects,
  getBuilderCredits,
  RenderRequest,
  RenderRequestType,
  RenderRequestPriority,
} from "@/lib/builder-api";
import { Project, RenderMessageAttachment } from "@/types/database";

export const dynamic = "force-dynamic";

// ── Constants ─────────────────────────────────────────────────────────────────

const RENDER_TYPES: { id: RenderRequestType; label: string; desc: string }[] = [
  { id: "exterior_elevation", label: "Exterior Elevation", desc: "Front/rear/side facade view" },
  { id: "interior",           label: "Interior Room",      desc: "Living, kitchen, master suite, etc." },
  { id: "aerial",             label: "Aerial / Bird's Eye", desc: "Top-down perspective view" },
  { id: "floor_plan",         label: "Floor Plan",          desc: "2D illustrated floor plan" },
  { id: "custom",             label: "Custom Angle",        desc: "Describe any specific angle or scene" },
];

const STATUS_CONFIG: Record<RenderRequest["status"], { label: string; style: string; step: number }> = {
  submitted:          { label: "Submitted",          style: "text-white/50 bg-white/6 border-white/12",              step: 1 },
  in_queue:           { label: "In Queue",           style: "text-amber-400 bg-amber-500/10 border-amber-500/20",    step: 2 },
  in_production:      { label: "In Production",      style: "text-blue-400 bg-blue-500/10 border-blue-500/20",       step: 3 },
  ready_for_review:   { label: "Ready for Review",   style: "text-violet-400 bg-violet-500/10 border-violet-500/20", step: 4 },
  delivered:          { label: "Delivered",          style: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20", step: 5 },
  completed:          { label: "Completed",          style: "text-green-400 bg-green-500/10 border-green-500/20",    step: 5 },
  revision_requested: { label: "Revision Needed",    style: "text-orange-400 bg-orange-500/10 border-orange-500/20", step: 3 },
};

const PIPELINE_STEPS = ["Submitted", "In Queue", "In Production", "Ready for Review", "Delivered"];

const TYPE_LABEL: Record<RenderRequestType, string> = {
  exterior_elevation: "Exterior Elevation",
  interior:           "Interior Room",
  aerial:             "Aerial",
  floor_plan:         "Floor Plan",
  custom:             "Custom Angle",
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const days = Math.floor(diff / 86400000);
  if (days < 1)  return "Today";
  if (days < 30) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function shortId(id: string) {
  return "#" + id.slice(0, 6).toUpperCase();
}

const INPUT    = "w-full bg-[#141414] border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white/80 placeholder-white/20 focus:outline-none focus:ring-1 focus:ring-blue-500/60 focus:border-blue-500/40 transition-colors";
const TEXTAREA = INPUT + " resize-none";
const SELECT   = "w-full bg-[#141414] border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white/80 focus:outline-none focus:ring-1 focus:ring-blue-500/60 focus:border-blue-500/40 transition-colors";

// ── Credit Meter ──────────────────────────────────────────────────────────────

function CreditMeter({ used, total }: { used: number; total: number }) {
  const pct = total > 0 ? Math.min((used / total) * 100, 100) : 0;
  const remaining = total - used;
  const isLow = remaining <= Math.ceil(total * 0.2);
  return (
    <div className="bg-[#0e0e0e] border border-white/8 rounded-2xl px-6 py-4 flex items-center gap-6 mb-6">
      <div className="flex-1">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-white/40 uppercase tracking-wide">Render Credits</span>
          <span className={`text-xs font-bold ${isLow ? "text-orange-400" : "text-white/60"}`}>
            {remaining} remaining
          </span>
        </div>
        <div className="h-1.5 bg-white/6 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${isLow ? "bg-orange-500" : "bg-blue-500"}`}
            style={{ width: `${pct}%` }}
          />
        </div>
        <p className="text-[11px] text-white/25 mt-1.5">{used} of {total} used this month</p>
      </div>
      <div className="text-right flex-shrink-0">
        <p className="text-2xl font-extrabold text-white">{remaining}</p>
        <p className="text-[10px] text-white/25">credits left</p>
      </div>
    </div>
  );
}

// ── Pipeline Steps ────────────────────────────────────────────────────────────

function PipelineSteps({ status }: { status: RenderRequest["status"] }) {
  const currentStep = STATUS_CONFIG[status].step;
  return (
    <div className="flex items-center gap-1 mt-3">
      {PIPELINE_STEPS.map((label, i) => {
        const step = i + 1;
        const done    = step < currentStep;
        const active  = step === currentStep && status !== "revision_requested";
        const pending = step > currentStep;
        return (
          <div key={label} className="flex items-center gap-1 flex-1 min-w-0">
            <div className={`h-1 flex-1 rounded-full transition-all ${
              done ? "bg-blue-500" : active ? "bg-blue-400" : "bg-white/8"
            }`} />
            {i === PIPELINE_STEPS.length - 1 && (
              <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                done || active ? "bg-blue-400" : "bg-white/12"
              }`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Render Request Card ───────────────────────────────────────────────────────

function RequestCard({
  req,
  projects,
  onRevision,
}: {
  req: RenderRequest;
  projects: Project[];
  onRevision: (req: RenderRequest) => void;
}) {
  const router  = useRouter();
  const project = projects.find(p => p.id === req.project_id);
  const cfg = STATUS_CONFIG[req.status];

  return (
    <div
      onClick={() => router.push(`/builder/3d-projects/${req.id}`)}
      className="bg-[#0e0e0e] border border-white/8 rounded-2xl overflow-hidden cursor-pointer hover:border-white/14 transition-colors"
    >
      {/* Thumbnail row — show deliverables if delivered */}
      {req.deliverable_urls.length > 0 && (
        <div className="flex gap-2 p-3 bg-[#080808] border-b border-white/6">
          {req.deliverable_urls.slice(0, 3).map((url, i) => (
            <a key={i} href={url} target="_blank" rel="noreferrer"
              onClick={e => e.stopPropagation()}
              className="relative w-24 h-16 rounded-lg overflow-hidden bg-white/5 flex-shrink-0 group">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt="Render" className="w-full h-full object-cover group-hover:opacity-80 transition-opacity" />
              <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/40">
                <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                </svg>
              </div>
            </a>
          ))}
          {req.deliverable_urls.length > 3 && (
            <div className="w-24 h-16 rounded-lg bg-white/4 flex-shrink-0 flex items-center justify-center">
              <span className="text-xs text-white/30">+{req.deliverable_urls.length - 3}</span>
            </div>
          )}
        </div>
      )}

      <div className="p-4">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="min-w-0">
            {(req as RenderRequest & { title?: string | null }).title && (
              <h3 className="font-bold text-white text-sm mb-0.5 truncate">
                {(req as RenderRequest & { title?: string | null }).title}
              </h3>
            )}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-mono text-white/25">{shortId(req.id)}</span>
              <span className={`text-[11px] px-2 py-0.5 rounded-full border font-semibold ${cfg.style}`}>
                {cfg.label}
              </span>
              {req.priority === "rush" && (
                <span className="text-[11px] px-2 py-0.5 rounded-full border font-semibold text-red-400 bg-red-500/10 border-red-500/20">
                  Rush
                </span>
              )}
            </div>
            <p className="text-xs text-white/50 mt-1">{TYPE_LABEL[req.type]}</p>
            {project && <p className="text-xs text-white/30 mt-0.5">{project.name}</p>}
          </div>
          <div className="flex-shrink-0 text-right">
            <p className="text-[11px] text-white/25">{timeAgo(req.created_at)}</p>
            <p className="text-[11px] text-white/20 mt-0.5">{req.credits_used} credit{req.credits_used > 1 ? "s" : ""}</p>
          </div>
        </div>

        {req.configuration_notes && (
          <p className="text-xs text-white/40 bg-white/4 rounded-lg px-3 py-2 mb-3 line-clamp-2">
            {req.configuration_notes}
          </p>
        )}

        {req.revision_notes && (
          <p className="text-xs text-orange-400/70 bg-orange-500/6 rounded-lg px-3 py-2 mb-3 border border-orange-500/15">
            Revision: {req.revision_notes}
          </p>
        )}

        {/* Pipeline */}
        {req.status !== "delivered" && req.status !== "revision_requested" && (
          <PipelineSteps status={req.status} />
        )}

        {/* Actions */}
        {req.status === "delivered" && (
          <div className="flex gap-2 mt-3">
            {req.deliverable_urls.length > 0 && (
              <a href={req.deliverable_urls[0]} target="_blank" rel="noreferrer"
                onClick={e => e.stopPropagation()}
                className="flex-1 py-2 rounded-xl bg-emerald-600/15 hover:bg-emerald-600/25 border border-emerald-500/20 text-emerald-400 text-xs font-semibold text-center transition-colors">
                Download Renders
              </a>
            )}
            <button
              onClick={e => { e.stopPropagation(); onRevision(req); }}
              className="flex-1 py-2 rounded-xl bg-white/5 hover:bg-white/8 border border-white/10 text-white/50 text-xs font-semibold transition-colors">
              Request Revision
            </button>
          </div>
        )}

        {/* View details link */}
        <div className="mt-3 pt-2 border-t border-white/5">
          <span className="text-xs text-blue-400/60 hover:text-blue-400 transition-colors">
            View details →
          </span>
        </div>
      </div>
    </div>
  );
}

// ── New Request Form (slide-over) ─────────────────────────────────────────────

function NewRequestForm({
  projects,
  credits,
  onClose,
  onSubmitted,
}: {
  projects: Project[];
  credits: { used: number; total: number } | null;
  onClose: () => void;
  onSubmitted: (req: RenderRequest) => void;
}) {
  const [title,        setTitle]        = useState("");
  const [type,         setType]         = useState<RenderRequestType>("exterior_elevation");
  const [projectId,    setProjectId]    = useState(projects[0]?.id ?? "");
  const [notes,        setNotes]        = useState("");
  const [priority,     setPriority]     = useState<RenderRequestPriority>("standard");
  const [submitting,   setSubmitting]   = useState(false);
  const [error,        setError]        = useState("");
  const [refFiles,       setRefFiles]       = useState<RenderMessageAttachment[]>([]);
  const [uploading,      setUploading]      = useState(false);
  const [refUploadError, setRefUploadError] = useState("");
  const refFileInput                        = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const creditCost   = priority === "rush" ? 2 : 1;
  const remaining    = credits ? credits.total - credits.used : null;
  const insufficient = remaining !== null && remaining < creditCost;

  async function handleRefFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    setUploading(true);
    const results = await Promise.all(files.map(async (file) => {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/upload/render-attachment", { method: "POST", body: fd });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Upload failed" }));
        return { error: err.error ?? "Upload failed" };
      }
      return res.json() as Promise<RenderMessageAttachment>;
    }));
    const valid  = results.filter((r): r is RenderMessageAttachment => !("error" in r));
    const errors = results.filter((r): r is { error: string } => "error" in r);
    if (errors.length > 0) {
      setRefUploadError(`${errors.length} file(s) failed to upload. Make sure the storage bucket exists.`);
      setTimeout(() => setRefUploadError(""), 6000);
    }
    setRefFiles(prev => [...prev, ...valid]);
    setUploading(false);
    if (refFileInput.current) refFileInput.current.value = "";
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (insufficient) return;
    if (!title.trim()) { setError("Please enter a project name."); return; }
    setSubmitting(true);
    setError("");
    const result = await createRenderRequest({
      project_id:          projectId || null,
      type,
      configuration_notes: notes || null,
      reference_files:     refFiles.map(f => f.url),
      priority,
      title:               title.trim(),
    });
    setSubmitting(false);
    if (result) {
      onSubmitted(result);
    } else {
      setError("Something went wrong. Please try again.");
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div ref={panelRef} className="w-[520px] bg-[#0a0a0a] border-l border-white/8 shadow-2xl flex flex-col">

        <div className="flex items-center justify-between px-6 py-5 border-b border-white/8 flex-shrink-0">
          <div>
            <h2 className="font-bold text-white text-lg">New Render Request</h2>
            <p className="text-xs text-white/30 mt-0.5">Our studio team will produce this for you.</p>
          </div>
          <button onClick={onClose} className="text-white/25 hover:text-white/60 transition-colors text-2xl leading-none">×</button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">

          {/* Render Project Name */}
          <div>
            <label className="block text-xs font-semibold text-white/40 mb-1.5 uppercase tracking-wide">Render Project Name *</label>
            <input
              type="text"
              required
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="e.g. Lot 12 – Exterior Elevation"
              className={INPUT}
            />
          </div>

          {/* Render type */}
          <div>
            <label className="block text-xs font-semibold text-white/40 mb-2 uppercase tracking-wide">Render Type *</label>
            <div className="space-y-2">
              {RENDER_TYPES.map(rt => (
                <button
                  key={rt.id}
                  type="button"
                  onClick={() => setType(rt.id)}
                  className={`w-full flex items-start gap-3 px-4 py-3 rounded-xl border text-left transition-all ${
                    type === rt.id
                      ? "bg-blue-600/12 border-blue-500/40 text-blue-300"
                      : "bg-white/3 border-white/8 text-white/50 hover:bg-white/5 hover:border-white/12"
                  }`}
                >
                  <div className={`w-3.5 h-3.5 rounded-full border-2 mt-0.5 flex-shrink-0 transition-colors ${
                    type === rt.id ? "border-blue-400 bg-blue-400" : "border-white/20"
                  }`} />
                  <div>
                    <p className={`text-sm font-semibold ${type === rt.id ? "text-blue-300" : "text-white/70"}`}>{rt.label}</p>
                    <p className="text-xs text-white/30 mt-0.5">{rt.desc}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Home Model */}
          {projects.length > 0 && (
            <div>
              <label className="block text-xs font-semibold text-white/40 mb-1.5 uppercase tracking-wide">Home Model</label>
              <select value={projectId} onChange={e => setProjectId(e.target.value)} className={SELECT}>
                <option value="">— None / General request —</option>
                {projects.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
          )}

          {/* Configuration notes */}
          <div>
            <label className="block text-xs font-semibold text-white/40 mb-1.5 uppercase tracking-wide">
              Configuration Notes
            </label>
            <textarea
              rows={4}
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Describe what options/finishes should be shown, angle, time of day, specific details for the artist…"
              className={TEXTAREA}
            />
          </div>

          {/* Reference Files */}
          <div>
            <label className="block text-xs font-semibold text-white/40 mb-1.5 uppercase tracking-wide">
              Reference Files (optional)
            </label>
            <div
              onClick={() => refFileInput.current?.click()}
              className="border border-dashed border-white/12 rounded-xl px-4 py-4 text-center cursor-pointer hover:border-white/20 hover:bg-white/3 transition-colors"
            >
              <p className="text-xs text-white/30">Click to attach reference images or files</p>
              <input ref={refFileInput} type="file" multiple className="hidden" onChange={handleRefFileSelect} />
            </div>
            {uploading && <p className="text-xs text-white/30 mt-1.5">Uploading…</p>}
            {refUploadError && <p className="text-xs text-red-400 mt-1.5">{refUploadError}</p>}
            {refFiles.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {refFiles.map((f, i) => (
                  <div key={i} className="flex items-center gap-1.5 bg-white/8 border border-white/10 rounded-lg px-2 py-1 text-xs text-white/60 max-w-[160px]">
                    <span className="truncate">{f.name}</span>
                    <button type="button" onClick={() => setRefFiles(prev => prev.filter((_, j) => j !== i))}
                      className="text-white/30 hover:text-white/70 flex-shrink-0">×</button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Priority */}
          <div>
            <label className="block text-xs font-semibold text-white/40 mb-2 uppercase tracking-wide">Priority</label>
            <div className="grid grid-cols-2 gap-2">
              {(["standard", "rush"] as const).map(p => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPriority(p)}
                  className={`px-4 py-3 rounded-xl border text-left transition-all ${
                    priority === p
                      ? p === "rush"
                        ? "bg-red-500/10 border-red-500/40 text-red-300"
                        : "bg-blue-600/12 border-blue-500/40 text-blue-300"
                      : "bg-white/3 border-white/8 text-white/50 hover:bg-white/5"
                  }`}
                >
                  <p className="text-sm font-bold capitalize">{p}</p>
                  <p className="text-xs text-white/30 mt-0.5">
                    {p === "standard" ? "5-day · 1 credit" : "2-day · 2 credits"}
                  </p>
                </button>
              ))}
            </div>
          </div>

          {/* Credit summary */}
          <div className={`rounded-xl px-4 py-3 border ${
            insufficient
              ? "bg-red-500/8 border-red-500/20"
              : "bg-white/4 border-white/8"
          }`}>
            <div className="flex items-center justify-between">
              <span className="text-xs text-white/40">Credit cost</span>
              <span className={`text-sm font-bold ${insufficient ? "text-red-400" : "text-white/80"}`}>
                {creditCost} credit{creditCost > 1 ? "s" : ""}
              </span>
            </div>
            {remaining !== null && (
              <div className="flex items-center justify-between mt-1">
                <span className="text-xs text-white/25">Your balance</span>
                <span className={`text-xs font-semibold ${insufficient ? "text-red-400" : "text-white/40"}`}>
                  {remaining} remaining
                </span>
              </div>
            )}
            {insufficient && (
              <p className="text-xs text-red-400 mt-2">
                Insufficient credits. Contact us to add more or upgrade your plan.
              </p>
            )}
          </div>

          {error && <p className="text-xs text-red-400">{error}</p>}

        </form>

        <div className="px-6 py-4 border-t border-white/8 flex-shrink-0">
          <button
            onClick={handleSubmit}
            disabled={submitting || insufficient}
            className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-bold transition-colors"
          >
            {submitting ? "Submitting…" : `Submit Request · ${creditCost} credit${creditCost > 1 ? "s" : ""}`}
          </button>
        </div>

      </div>
    </div>
  );
}

// ── Revision Modal ────────────────────────────────────────────────────────────

function RevisionModal({
  req,
  onClose,
  onSubmitted,
}: {
  req: RenderRequest;
  onClose: () => void;
  onSubmitted: (id: string) => void;
}) {
  const [notes,      setNotes]      = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!notes.trim()) return;
    setSubmitting(true);
    const ok = await requestRenderRevision(req.id, notes);
    setSubmitting(false);
    if (ok) onSubmitted(req.id);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-[#0e0e0e] border border-white/10 rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/8">
          <h3 className="font-bold text-white">Request Revision</h3>
          <button onClick={onClose} className="text-white/25 hover:text-white/60 text-xl leading-none">×</button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <p className="text-xs text-white/40">Describe what needs to be changed. This will re-enter the production queue.</p>
          <textarea
            required
            rows={4}
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="e.g. Change the roof color to dark grey, add more landscaping on the left side…"
            className={TEXTAREA}
          />
          <button type="submit" disabled={submitting || !notes.trim()}
            className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-sm font-bold transition-colors">
            {submitting ? "Submitting…" : "Submit Revision Request"}
          </button>
        </form>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

function ThreeDProjectsContent() {
  const [requests,       setRequests]       = useState<RenderRequest[]>([]);
  const [projects,       setProjects]       = useState<Project[]>([]);
  const [credits,        setCredits]        = useState<{ used: number; total: number } | null>(null);
  const [loading,        setLoading]        = useState(true);
  const [tab,            setTab]            = useState<"active" | "history">("active");
  const [showForm,       setShowForm]       = useState(false);
  const [revisionTarget, setRevisionTarget] = useState<RenderRequest | null>(null);

  useEffect(() => {
    Promise.all([getRenderRequests(), getBuilderProjects(), getBuilderCredits()]).then(
      ([reqs, projs, creds]) => {
        setRequests(reqs);
        setProjects(projs);
        setCredits(creds);
        setLoading(false);
      }
    );
  }, []);

  function handleNewRequest(req: RenderRequest) {
    setRequests(prev => [req, ...prev]);
    if (credits) setCredits({ ...credits, used: credits.used + req.credits_used });
    setShowForm(false);
    setTab("active");
  }

  function handleRevisionSubmitted(id: string) {
    setRequests(prev => prev.map(r =>
      r.id === id ? { ...r, status: "revision_requested" as const } : r
    ));
    setRevisionTarget(null);
  }

  const activeRequests  = requests.filter(r => r.status !== "delivered");
  const historyRequests = requests.filter(r => r.status === "delivered");

  const activeCountdown = requests.find(
    r => r.completion_date_status === "accepted" && r.proposed_completion_date
  );

  const stats = {
    total:      requests.length,
    inProgress: requests.filter(r => ["in_queue", "in_production", "ready_for_review"].includes(r.status)).length,
    delivered:  historyRequests.length,
  };

  return (
    <div className="p-8 max-w-7xl mx-auto text-white">

      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">3D Projects</h1>
          <p className="text-sm text-white/30 mt-0.5">
            Request professional 3D renders from our studio team — included in your plan.
          </p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-sm font-bold transition-colors shadow-lg shadow-blue-600/20 flex items-center gap-2"
        >
          <span className="text-base leading-none">+</span>
          New Render Request
        </button>
      </div>

      {/* Credit Meter */}
      {credits && <CreditMeter used={credits.used} total={credits.total} />}

      {/* Active countdown strip */}
      {activeCountdown && activeCountdown.proposed_completion_date && (
        <div className="bg-blue-600/6 border border-blue-500/20 rounded-2xl px-5 py-3 flex items-center gap-3 mb-6">
          <span className="text-base flex-shrink-0">⏱</span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-white/80 truncate">
              {activeCountdown.title ?? "Render Request"}
            </p>
            <p className="text-xs text-blue-400/80">
              Due in {Math.max(0, Math.ceil((new Date(activeCountdown.proposed_completion_date).getTime() - Date.now()) / 86400000))} days
              {" · "}
              {new Date(activeCountdown.proposed_completion_date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
            </p>
          </div>
          <a
            href={`/builder/3d-projects/${activeCountdown.id}`}
            className="flex-shrink-0 text-xs font-semibold text-blue-400 hover:text-blue-300 transition-colors"
          >
            View →
          </a>
        </div>
      )}

      {/* Stats */}
      {!loading && (
        <div className="grid grid-cols-3 gap-3 mb-6">
          {[
            { label: "Total Requests", value: stats.total,      accent: "text-white"        },
            { label: "In Progress",    value: stats.inProgress, accent: "text-blue-400"     },
            { label: "Delivered",      value: stats.delivered,  accent: "text-emerald-400"  },
          ].map(s => (
            <div key={s.label} className="bg-[#0e0e0e] rounded-2xl border border-white/8 px-5 py-4">
              <p className="text-[10px] text-white/25 uppercase tracking-widest font-semibold">{s.label}</p>
              <p className={`text-3xl font-extrabold mt-1 ${s.accent}`}>{s.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-white/4 border border-white/8 rounded-xl w-fit mb-6">
        {([
          { key: "active",  label: `Active (${activeRequests.length})`  },
          { key: "history", label: `Delivered (${historyRequests.length})` },
        ] as const).map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-all ${
              tab === t.key ? "bg-[#141414] text-white border border-white/10" : "text-white/30"
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {[1,2,3].map(i => <div key={i} className="h-48 bg-[#0e0e0e] rounded-2xl animate-pulse" />)}
        </div>
      ) : (
        <>
          {tab === "active" && (
            activeRequests.length === 0 ? (
              <div className="bg-[#0e0e0e] border border-white/8 rounded-2xl py-20 text-center">
                <div className="w-12 h-12 mx-auto mb-4 rounded-2xl bg-blue-500/10 border border-blue-500/15 flex items-center justify-center">
                  <svg className="w-6 h-6 text-blue-400/60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 7.5l-9-5.25L3 7.5m18 0l-9 5.25m9-5.25v9l-9 5.25M3 7.5l9 5.25M3 7.5v9l9 5.25m0-9v9" />
                  </svg>
                </div>
                <p className="text-white/30 text-sm mb-1">No active render requests.</p>
                <p className="text-white/20 text-xs mb-4">Submit a request and our team will get to work.</p>
                <button
                  onClick={() => setShowForm(true)}
                  className="text-blue-400 text-sm font-semibold hover:text-blue-300 transition-colors">
                  + New Render Request
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {activeRequests.map(req => (
                  <RequestCard key={req.id} req={req} projects={projects} onRevision={setRevisionTarget} />
                ))}
              </div>
            )
          )}

          {tab === "history" && (
            historyRequests.length === 0 ? (
              <div className="bg-[#0e0e0e] border border-white/8 rounded-2xl py-20 text-center">
                <p className="text-white/30 text-sm">No delivered renders yet.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {historyRequests.map(req => (
                  <RequestCard key={req.id} req={req} projects={projects} onRevision={setRevisionTarget} />
                ))}
              </div>
            )
          )}
        </>
      )}

      {/* Slide-over: New Request */}
      {showForm && (
        <NewRequestForm
          projects={projects}
          credits={credits}
          onClose={() => setShowForm(false)}
          onSubmitted={handleNewRequest}
        />
      )}

      {/* Modal: Revision */}
      {revisionTarget && (
        <RevisionModal
          req={revisionTarget}
          onClose={() => setRevisionTarget(null)}
          onSubmitted={handleRevisionSubmitted}
        />
      )}

    </div>
  );
}

export default function ThreeDProjectsPage() {
  return (
    <Suspense fallback={<div className="p-8 text-white/20">Loading…</div>}>
      <ThreeDProjectsContent />
    </Suspense>
  );
}
