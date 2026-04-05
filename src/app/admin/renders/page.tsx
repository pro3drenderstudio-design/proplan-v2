"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { getAllRenderRequests, updateRenderRequestStatus, RenderRequestWithBuilder } from "@/lib/admin-api";
import { RenderRequestStatus, RenderRequestType } from "@/types/database";

// ── Constants ─────────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<RenderRequestStatus, { label: string; style: string; next?: RenderRequestStatus }> = {
  submitted:          { label: "Submitted",        style: "text-white/50 bg-white/6 border-white/12",              next: "in_queue"         },
  in_queue:           { label: "In Queue",          style: "text-amber-400 bg-amber-500/10 border-amber-500/20",    next: "in_production"    },
  in_production:      { label: "In Production",    style: "text-blue-400 bg-blue-500/10 border-blue-500/20",       next: "ready_for_review" },
  ready_for_review:   { label: "Ready for Review", style: "text-violet-400 bg-violet-500/10 border-violet-500/20", next: "delivered"        },
  delivered:          { label: "Delivered",        style: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20", next: "completed"       },
  completed:          { label: "Completed",        style: "text-green-400 bg-green-500/10 border-green-500/20" },
  revision_requested: { label: "Revision Needed",  style: "text-orange-400 bg-orange-500/10 border-orange-500/20", next: "in_queue"         },
};

const TYPE_LABEL: Record<RenderRequestType, string> = {
  exterior_elevation: "Exterior Elevation",
  interior:           "Interior Room",
  aerial:             "Aerial",
  floor_plan:         "Floor Plan",
  custom:             "Custom Angle",
};

const FILTER_STATUSES: { key: string; label: string }[] = [
  { key: "all",               label: "All"             },
  { key: "submitted",         label: "Submitted"       },
  { key: "in_queue",          label: "In Queue"        },
  { key: "in_production",     label: "In Production"   },
  { key: "ready_for_review",  label: "Ready to Review" },
  { key: "revision_requested", label: "Revision Needed" },
  { key: "delivered",         label: "Delivered"       },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const hrs  = Math.floor(diff / 3_600_000);
  const days = Math.floor(diff / 86_400_000);
  if (hrs < 1)  return "Just now";
  if (hrs < 24) return `${hrs}h ago`;
  if (days < 30) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function shortId(id: string) {
  return "#" + id.slice(0, 6).toUpperCase();
}

// ── Deliver Modal ─────────────────────────────────────────────────────────────

function DeliverModal({
  req,
  onClose,
  onDelivered,
}: {
  req: RenderRequestWithBuilder;
  onClose: () => void;
  onDelivered: (id: string, urls: string[]) => void;
}) {
  const [urls,       setUrls]       = useState<string[]>([""]);
  const [notes,      setNotes]      = useState(req.admin_notes ?? "");
  const [submitting, setSubmitting] = useState(false);

  const validUrls = urls.filter(u => u.trim().length > 0);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (validUrls.length === 0) return;
    setSubmitting(true);
    const ok = await updateRenderRequestStatus(req.id, "delivered", {
      deliverable_urls: validUrls,
      admin_notes: notes || undefined,
    });
    setSubmitting(false);
    if (ok) onDelivered(req.id, validUrls);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-[#0e0e0e] border border-white/10 rounded-2xl shadow-2xl w-full max-w-lg">
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/8">
          <div>
            <h3 className="font-bold text-white">Deliver Renders</h3>
            <p className="text-xs text-white/35 mt-0.5">{req.builder_name} · {shortId(req.id)}</p>
          </div>
          <button onClick={onClose} className="text-white/25 hover:text-white/60 text-xl leading-none">×</button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-white/40 mb-2 uppercase tracking-wide">
              Deliverable URLs *
            </label>
            <div className="space-y-2">
              {urls.map((url, i) => (
                <div key={i} className="flex gap-2">
                  <input
                    type="url"
                    value={url}
                    onChange={e => setUrls(prev => prev.map((u, j) => j === i ? e.target.value : u))}
                    placeholder="https://…"
                    className="flex-1 bg-[#141414] border border-white/10 rounded-xl px-3 py-2 text-sm text-white/80 placeholder-white/20 focus:outline-none focus:ring-1 focus:ring-blue-500/60 focus:border-blue-500/40"
                  />
                  {urls.length > 1 && (
                    <button type="button" onClick={() => setUrls(prev => prev.filter((_, j) => j !== i))}
                      className="text-white/20 hover:text-red-400 px-2 transition-colors">×</button>
                  )}
                </div>
              ))}
              <button type="button" onClick={() => setUrls(prev => [...prev, ""])}
                className="text-xs text-blue-400 hover:text-blue-300 transition-colors">
                + Add another file
              </button>
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-white/40 mb-1.5 uppercase tracking-wide">Internal Notes</label>
            <textarea
              rows={2}
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Optional notes for your team…"
              className="w-full bg-[#141414] border border-white/10 rounded-xl px-3 py-2 text-sm text-white/80 placeholder-white/20 focus:outline-none focus:ring-1 focus:ring-blue-500/60 focus:border-blue-500/40 resize-none"
            />
          </div>
          <button type="submit" disabled={submitting || validUrls.length === 0}
            className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white text-sm font-bold transition-colors">
            {submitting ? "Delivering…" : `Mark as Delivered (${validUrls.length} file${validUrls.length !== 1 ? "s" : ""})`}
          </button>
        </form>
      </div>
    </div>
  );
}

// ── Request Row ───────────────────────────────────────────────────────────────

function RequestRow({
  req,
  onStatusChange,
  onDeliver,
}: {
  req: RenderRequestWithBuilder;
  onStatusChange: (id: string, status: RenderRequestStatus) => void;
  onDeliver: (req: RenderRequestWithBuilder) => void;
}) {
  const router    = useRouter();
  const [updating, setUpdating] = useState(false);
  const cfg = STATUS_CONFIG[req.status];

  async function advanceStatus(e: React.MouseEvent) {
    e.stopPropagation();
    if (!cfg.next || updating) return;
    if (cfg.next === "delivered") { onDeliver(req); return; }  // already has stopPropagation from advanceStatus
    setUpdating(true);
    const ok = await updateRenderRequestStatus(req.id, cfg.next);
    setUpdating(false);
    if (ok) onStatusChange(req.id, cfg.next);
  }

  return (
    <div
      onClick={() => router.push(`/admin/renders/${req.id}`)}
      className="bg-[#0e0e0e] border border-white/8 rounded-2xl p-4 cursor-pointer hover:border-white/14 transition-colors"
    >
      <div className="flex items-start gap-4">

        {/* Left: info */}
        <div className="flex-1 min-w-0">
          {(req as RenderRequestWithBuilder & { title?: string | null }).title && (
            <p className="font-bold text-white text-sm mb-0.5 truncate">
              {(req as RenderRequestWithBuilder & { title?: string | null }).title}
            </p>
          )}
          <div className="flex items-center gap-2 flex-wrap mb-1.5">
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

          <h3 className="font-bold text-white/85 text-sm">{TYPE_LABEL[req.type]}</h3>

          <div className="flex items-center gap-3 mt-1 flex-wrap">
            <span className="text-xs text-white/35">{req.builder_name}</span>
            {req.project_name && (
              <>
                <span className="text-white/15">·</span>
                <span className="text-xs text-white/35">{req.project_name}</span>
              </>
            )}
            <span className="text-white/15">·</span>
            <span className="text-xs text-white/25">{timeAgo(req.created_at)}</span>
          </div>

          {req.configuration_notes && (
            <p className="text-xs text-white/40 bg-white/4 rounded-lg px-3 py-2 mt-2.5 line-clamp-2">
              {req.configuration_notes}
            </p>
          )}

          {req.revision_notes && (
            <p className="text-xs text-orange-400/70 bg-orange-500/6 rounded-lg px-3 py-2 mt-2 border border-orange-500/15">
              Revision: {req.revision_notes}
            </p>
          )}

          {/* Deliverables */}
          {req.deliverable_urls.length > 0 && (
            <div className="flex gap-2 mt-2.5 flex-wrap">
              {req.deliverable_urls.map((url, i) => (
                <a key={i} href={url} target="_blank" rel="noreferrer"
                  onClick={e => e.stopPropagation()}
                  className="text-xs text-emerald-400 hover:text-emerald-300 underline underline-offset-2 transition-colors">
                  File {i + 1}
                </a>
              ))}
            </div>
          )}
        </div>

        {/* Right: action */}
        <div className="flex-shrink-0 flex flex-col items-end gap-2">
          <span className="text-[11px] text-white/25">{req.credits_used} credit{req.credits_used > 1 ? "s" : ""}</span>
          {cfg.next && (
            <button
              onClick={advanceStatus}
              disabled={updating}
              className={`text-xs px-3 py-1.5 rounded-xl font-semibold transition-colors disabled:opacity-40 ${
                cfg.next === "delivered"
                  ? "bg-emerald-600/15 hover:bg-emerald-600/25 border border-emerald-500/20 text-emerald-400"
                  : "bg-blue-600/12 hover:bg-blue-600/20 border border-blue-500/20 text-blue-400"
              }`}
            >
              {updating ? "…" : cfg.next === "delivered" ? "Deliver →" : `→ ${STATUS_CONFIG[cfg.next].label}`}
            </button>
          )}
          <span className="text-[11px] text-blue-400/50 hover:text-blue-400 transition-colors">View →</span>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function AdminRendersPage() {
  const [requests,     setRequests]     = useState<RenderRequestWithBuilder[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");
  const [search,       setSearch]       = useState("");
  const [delivering,   setDelivering]   = useState<RenderRequestWithBuilder | null>(null);

  useEffect(() => {
    getAllRenderRequests().then(reqs => { setRequests(reqs); setLoading(false); });
  }, []);

  const filtered = useMemo(() => {
    return requests.filter(r => {
      const matchStatus = statusFilter === "all" || r.status === statusFilter;
      const q = search.toLowerCase();
      const matchSearch = !q ||
        r.builder_name.toLowerCase().includes(q) ||
        (r.project_name ?? "").toLowerCase().includes(q) ||
        TYPE_LABEL[r.type].toLowerCase().includes(q) ||
        r.id.toLowerCase().includes(q);
      return matchStatus && matchSearch;
    });
  }, [requests, statusFilter, search]);

  function handleStatusChange(id: string, status: RenderRequestStatus) {
    setRequests(prev => prev.map(r => r.id === id ? { ...r, status } : r));
  }

  function handleDelivered(id: string, urls: string[]) {
    setRequests(prev => prev.map(r =>
      r.id === id ? { ...r, status: "delivered" as const, deliverable_urls: urls } : r
    ));
    setDelivering(null);
  }

  const stats = {
    total:     requests.length,
    rush:      requests.filter(r => r.priority === "rush" && r.status !== "delivered").length,
    active:    requests.filter(r => !["delivered"].includes(r.status)).length,
    delivered: requests.filter(r => r.status === "delivered").length,
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">

      {/* Header */}
      <div className="px-6 py-4 border-b border-white/8 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-base font-bold text-white">Render Queue</h1>
            <p className="text-xs text-white/35 mt-0.5">Manage 3D render requests from builders</p>
          </div>
          {/* Stats pills */}
          <div className="flex items-center gap-2">
            {stats.rush > 0 && (
              <span className="text-xs px-2.5 py-1 rounded-full bg-red-500/10 border border-red-500/20 text-red-400 font-semibold">
                {stats.rush} Rush
              </span>
            )}
            <span className="text-xs px-2.5 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 font-semibold">
              {stats.active} Active
            </span>
            <span className="text-xs px-2.5 py-1 rounded-full bg-white/6 border border-white/10 text-white/40 font-semibold">
              {stats.delivered} Delivered
            </span>
          </div>
        </div>

        {/* Search + filter */}
        <div className="flex gap-3 mt-4">
          <div className="relative flex-1 max-w-xs">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/25" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
            </svg>
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search builder, model, type…"
              className="w-full pl-8 pr-3 py-2 bg-white/4 border border-white/8 rounded-xl text-sm text-white/70 placeholder-white/20 focus:outline-none focus:ring-1 focus:ring-blue-500/40 focus:border-blue-500/30 transition-colors"
            />
          </div>
          <div className="flex gap-1 p-1 bg-white/4 border border-white/8 rounded-xl overflow-x-auto">
            {FILTER_STATUSES.map(f => (
              <button key={f.key} onClick={() => setStatusFilter(f.key)}
                className={`px-3 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                  statusFilter === f.key
                    ? "bg-[#141414] text-white border border-white/10"
                    : "text-white/30 hover:text-white/60"
                }`}>
                {f.label}
                {f.key !== "all" && (
                  <span className="ml-1 text-white/20">
                    ({requests.filter(r => r.status === f.key).length})
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto p-6">
        {loading ? (
          <div className="space-y-3">
            {[1,2,3,4].map(i => <div key={i} className="h-28 bg-[#0e0e0e] rounded-2xl animate-pulse" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-center">
            <p className="text-white/30 text-sm">No requests found.</p>
            {statusFilter !== "all" && (
              <button onClick={() => setStatusFilter("all")} className="text-blue-400 text-xs mt-2">Clear filter</button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {/* Rush requests first */}
            {filtered
              .sort((a, b) => {
                // Rush + non-delivered first
                const aRush = a.priority === "rush" && a.status !== "delivered" ? 0 : 1;
                const bRush = b.priority === "rush" && b.status !== "delivered" ? 0 : 1;
                if (aRush !== bRush) return aRush - bRush;
                return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
              })
              .map(req => (
                <RequestRow
                  key={req.id}
                  req={req}
                  onStatusChange={handleStatusChange}
                  onDeliver={setDelivering}
                />
              ))
            }
          </div>
        )}
      </div>

      {/* Deliver modal */}
      {delivering && (
        <DeliverModal
          req={delivering}
          onClose={() => setDelivering(null)}
          onDelivered={handleDelivered}
        />
      )}

    </div>
  );
}
