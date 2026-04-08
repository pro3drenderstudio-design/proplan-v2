"use client";

import { useEffect, useRef, useState, Suspense } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  getRenderRequestById,
  getRenderMessages,
  sendBuilderMessage,
  requestRenderRevision,
  respondToCompletionDate,
  proposeCounterDate,
  RenderRequest,
} from "@/lib/builder-api";
import { RenderMessage, RenderMessageAttachment } from "@/types/database";

export const dynamic = "force-dynamic";

// ── Constants ─────────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<RenderRequest["status"], { label: string; style: string; step: number }> = {
  submitted:          { label: "Submitted",          style: "text-white/50 bg-white/6 border-white/10",                step: 1 },
  in_queue:           { label: "In Queue",           style: "text-amber-400 bg-amber-500/10 border-amber-500/20",      step: 2 },
  in_production:      { label: "In Production",      style: "text-blue-400 bg-blue-500/10 border-blue-500/20",         step: 3 },
  ready_for_review:   { label: "Ready for Review",   style: "text-violet-400 bg-violet-500/10 border-violet-500/20",   step: 4 },
  delivered:          { label: "Delivered",          style: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20", step: 5 },
  revision_requested: { label: "Revision Requested", style: "text-orange-400 bg-orange-500/10 border-orange-500/20",   step: 2 },
  completed:          { label: "Completed",           style: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20", step: 5 },
};

const TYPE_LABEL: Record<RenderRequest["type"], string> = {
  exterior_elevation: "Exterior Elevation",
  interior:           "Interior Room",
  aerial:             "Aerial",
  floor_plan:         "Floor Plan",
  custom:             "Custom Angle",
};

const PIPELINE_STEPS = ["Submitted", "In Queue", "In Production", "Ready for Review", "Delivered"];

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatTime(dateStr: string) {
  return new Date(dateStr).toLocaleString("en-US", {
    month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
  });
}

function shortId(id: string) {
  return "#" + id.slice(0, 6).toUpperCase();
}

function isImageType(mime: string) {
  return mime.startsWith("image/");
}

// ── Countdown Timer ───────────────────────────────────────────────────────────

function getTimeLeft(d: string) {
  const diff = new Date(d).getTime() - Date.now();
  if (diff <= 0) return { days: 0, hours: 0, minutes: 0, seconds: 0, done: true };
  return {
    days:    Math.floor(diff / 86400000),
    hours:   Math.floor((diff % 86400000) / 3600000),
    minutes: Math.floor((diff % 3600000) / 60000),
    seconds: Math.floor((diff % 60000) / 1000),
    done:    false,
  };
}

function CountdownTimer({ targetDate }: { targetDate: string }) {
  const [timeLeft, setTimeLeft] = useState(getTimeLeft(targetDate));

  useEffect(() => {
    const t = setInterval(() => setTimeLeft(getTimeLeft(targetDate)), 1000);
    return () => clearInterval(t);
  }, [targetDate]);

  if (timeLeft.done) {
    return (
      <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl px-5 py-4 text-center">
        <p className="text-emerald-400 font-bold">🎉 Completion date reached!</p>
      </div>
    );
  }

  return (
    <div className="bg-blue-600/8 border border-blue-500/20 rounded-2xl px-5 py-4">
      <p className="text-xs font-semibold text-blue-400/70 uppercase tracking-wide mb-3">
        Estimated Completion
      </p>
      <div className="flex items-center gap-3 justify-center">
        {[
          { value: timeLeft.days,    label: "Days"    },
          { value: timeLeft.hours,   label: "Hours"   },
          { value: timeLeft.minutes, label: "Mins"    },
          { value: timeLeft.seconds, label: "Secs"    },
        ].map(({ value, label }, i, arr) => (
          <div key={label} className="flex items-center gap-3">
            <div className="text-center">
              <p className="text-2xl font-extrabold text-white tabular-nums">{String(value).padStart(2, "0")}</p>
              <p className="text-[10px] text-white/30 uppercase tracking-wide">{label}</p>
            </div>
            {i < arr.length - 1 && <span className="text-white/20 text-xl font-light mb-3">:</span>}
          </div>
        ))}
      </div>
      <p className="text-xs text-white/25 text-center mt-3">
        Due {new Date(targetDate).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
      </p>
    </div>
  );
}

// ── Attachment Chip ───────────────────────────────────────────────────────────

function AttachmentChip({
  att,
  onRemove,
}: {
  att: RenderMessageAttachment & { pending?: boolean };
  onRemove?: () => void;
}) {
  const isImage = isImageType(att.type);
  return (
    <div className="flex items-center gap-1.5 bg-white/8 border border-white/10 rounded-lg px-2 py-1 text-xs text-white/60 max-w-[160px]">
      {isImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={att.url} alt={att.name} className="w-5 h-5 rounded object-cover flex-shrink-0" />
      ) : (
        <svg className="w-4 h-4 flex-shrink-0 text-white/30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M18.375 12.739l-7.693 7.693a4.5 4.5 0 01-6.364-6.364l10.94-10.94A3 3 0 1119.5 7.372L8.552 18.32m.009-.01l-.01.01m5.699-9.941l-7.81 7.81a1.5 1.5 0 002.112 2.13" />
        </svg>
      )}
      <span className="truncate">{att.name}</span>
      {onRemove && (
        <button onClick={onRemove} className="ml-0.5 text-white/30 hover:text-white/70 flex-shrink-0">×</button>
      )}
    </div>
  );
}

// ── Message Attachments Display ───────────────────────────────────────────────

function MessageAttachments({ attachments }: { attachments: RenderMessageAttachment[] }) {
  if (attachments.length === 0) return null;

  const images = attachments.filter(a => isImageType(a.type));
  const files  = attachments.filter(a => !isImageType(a.type));

  return (
    <div className="mt-2 space-y-2">
      {images.length > 0 && (
        <div className="grid grid-cols-3 gap-1.5">
          {images.map((att, i) => (
            <a key={i} href={att.url} target="_blank" rel="noreferrer"
              className="block rounded-lg overflow-hidden aspect-square bg-white/5 hover:opacity-80 transition-opacity">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={att.url} alt={att.name} className="w-full h-full object-cover" />
            </a>
          ))}
        </div>
      )}
      {files.map((att, i) => (
        <a key={i} href={att.url} target="_blank" rel="noreferrer" download
          className="flex items-center gap-2 bg-white/5 hover:bg-white/8 border border-white/10 rounded-lg px-3 py-2 text-xs text-white/60 hover:text-white/80 transition-colors">
          <svg className="w-4 h-4 flex-shrink-0 text-white/30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
          </svg>
          <span className="truncate">{att.name}</span>
          <span className="ml-auto text-white/25 flex-shrink-0">{(att.size / 1024).toFixed(0)}KB</span>
        </a>
      ))}
    </div>
  );
}

// ── Message Bubble ────────────────────────────────────────────────────────────

function MessageBubble({ msg }: { msg: RenderMessage }) {
  const isBuilder  = msg.sender_type === "builder";
  const isDelivery = msg.is_delivery;

  return (
    <div className={`flex flex-col gap-1 max-w-[80%] ${isBuilder ? "items-end ml-auto" : "items-start mr-auto"}`}>
      {isDelivery && (
        <div className={`w-full px-4 py-3 rounded-2xl border ${
          isBuilder
            ? "bg-yellow-500/10 border-yellow-500/30 rounded-br-sm"
            : "bg-yellow-500/8 border-yellow-500/25 rounded-bl-sm"
        }`}>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-yellow-400 font-bold text-xs uppercase tracking-wide">Delivery</span>
          </div>
          {msg.body && <p className="text-sm text-white/80 whitespace-pre-wrap">{msg.body}</p>}
          <MessageAttachments attachments={msg.attachments} />
        </div>
      )}
      {!isDelivery && (
        <div className={`px-4 py-3 rounded-2xl ${
          isBuilder
            ? "bg-blue-600/80 text-white rounded-br-sm"
            : "bg-[#1a1a1a] border border-white/10 text-white/85 rounded-bl-sm"
        }`}>
          {msg.body && <p className="text-sm whitespace-pre-wrap">{msg.body}</p>}
          <MessageAttachments attachments={msg.attachments} />
        </div>
      )}
      <p className="text-[11px] text-white/25 px-1">
        {msg.sender_name} · {formatTime(msg.created_at)}
      </p>
    </div>
  );
}

// ── Pipeline Steps ────────────────────────────────────────────────────────────

function PipelineSteps({ status }: { status: RenderRequest["status"] }) {
  const currentStep = STATUS_CONFIG[status].step;
  return (
    <div className="flex items-center gap-1 mt-3">
      {PIPELINE_STEPS.map((label, i) => {
        const step   = i + 1;
        const done   = step < currentStep;
        const active = step === currentStep && status !== "revision_requested";
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

// ── Revision Modal ────────────────────────────────────────────────────────────

function RevisionModal({
  req,
  onClose,
  onSubmitted,
}: {
  req: RenderRequest;
  onClose: () => void;
  onSubmitted: () => void;
}) {
  const [notes, setNotes]           = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!notes.trim()) return;
    setSubmitting(true);
    const ok = await requestRenderRevision(req.id, notes);
    setSubmitting(false);
    if (ok) onSubmitted();
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
            className="w-full bg-[#141414] border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white/80 placeholder-white/20 focus:outline-none focus:ring-1 focus:ring-blue-500/60 focus:border-blue-500/40 resize-none transition-colors"
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

// ── Main Detail Content ───────────────────────────────────────────────────────

function RenderDetailContent() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = params.id;

  const [req,          setReq]          = useState<RenderRequest | null>(null);
  const [messages,     setMessages]     = useState<RenderMessage[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [msgBody,      setMsgBody]      = useState("");
  const [attachments,  setAttachments]  = useState<RenderMessageAttachment[]>([]);
  const [uploading,    setUploading]    = useState(false);
  const [uploadError,  setUploadError]  = useState("");
  const [sending,      setSending]      = useState(false);
  const [showRevision,   setShowRevision]   = useState(false);
  const [respondingDate, setRespondingDate] = useState(false);
  const [showCounter,    setShowCounter]    = useState(false);
  const [counterDate,    setCounterDate]    = useState("");
  const [acceptingDelivery, setAcceptingDelivery] = useState(false);
  const [chatOpen,          setChatOpen]          = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const bottomRef    = useRef<HTMLDivElement>(null);

  async function loadAll() {
    const [r, msgs] = await Promise.all([getRenderRequestById(id), getRenderMessages(id)]);
    if (r) setReq(r);
    setMessages(msgs);
  }

  useEffect(() => {
    Promise.all([
      getRenderRequestById(id),
      getRenderMessages(id),
    ]).then(([r, msgs]) => {
      setReq(r);
      setMessages(msgs);
      setLoading(false);
    });
  }, [id]);

  // Poll for new messages AND request status every 8 seconds
  useEffect(() => {
    const interval = setInterval(loadAll, 8000);
    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
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
      setUploadError(`${errors.length} file(s) failed to upload. Make sure the storage bucket exists.`);
      setTimeout(() => setUploadError(""), 6000);
    }
    setAttachments(prev => [...prev, ...valid]);
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    const bodyTrim = msgBody.trim();
    if (!bodyTrim && attachments.length === 0) return;
    setSending(true);
    const msg = await sendBuilderMessage(id, bodyTrim || null, attachments);
    setSending(false);
    if (msg) {
      setMessages(prev => [...prev, msg]);
      setMsgBody("");
      setAttachments([]);
    }
  }

  function handleRevisionSubmitted() {
    setShowRevision(false);
    setReq(prev => prev ? { ...prev, status: "revision_requested" } : prev);
  }

  function fmtDate(d: string) {
    return new Date(d).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  }

  async function handleAcceptDate() {
    if (!req || respondingDate) return;
    setRespondingDate(true);
    const ok = await respondToCompletionDate(req.id, true);
    if (ok) {
      await sendBuilderMessage(req.id, `✅ Completion date accepted: ${fmtDate(req.proposed_completion_date!)}`, []);
      setReq(prev => prev ? { ...prev, completion_date_status: "accepted" } : prev);
      await loadAll();
    }
    setRespondingDate(false);
  }

  async function handleCounterDate() {
    if (!req || !counterDate || respondingDate) return;
    setRespondingDate(true);
    const ok = await proposeCounterDate(req.id, counterDate);
    if (ok) {
      await sendBuilderMessage(
        req.id,
        `❌ Declined proposed date. Counter-proposed: ${fmtDate(counterDate)}`,
        [],
      );
      // Status is now "counter_proposed" — admin must respond
      setReq(prev => prev
        ? { ...prev, proposed_completion_date: counterDate, completion_date_status: "counter_proposed" }
        : prev,
      );
      setShowCounter(false);
      setCounterDate("");
      await loadAll();
    }
    setRespondingDate(false);
  }

  async function acceptDelivery() {
    if (!req || acceptingDelivery) return;
    setAcceptingDelivery(true);
    // Update status to completed via API (service role bypasses RLS)
    const res = await fetch(`/api/render-requests/${req.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "completed" }),
    });
    if (res.ok) {
      await sendBuilderMessage(req.id, "✅ Delivery accepted — project completed.", []);
      setReq(prev => prev ? { ...prev, status: "completed" } : prev);
      await loadAll();
    }
    setAcceptingDelivery(false);
  }

  if (loading) {
    return (
      <div className="p-8 max-w-4xl mx-auto text-white">
        <div className="h-32 bg-[#0e0e0e] rounded-2xl animate-pulse mb-4" />
        <div className="h-96 bg-[#0e0e0e] rounded-2xl animate-pulse" />
      </div>
    );
  }

  if (!req) {
    return (
      <div className="p-8 max-w-4xl mx-auto text-white text-center">
        <p className="text-white/30">Render request not found.</p>
        <button onClick={() => router.push("/builder/3d-projects")} className="mt-4 text-blue-400 text-sm">
          ← Back to 3D Projects
        </button>
      </div>
    );
  }

  const cfg = STATUS_CONFIG[req.status];
  const canSend = !sending && !uploading && (msgBody.trim().length > 0 || attachments.length > 0);
  const canRevise = req.status === "delivered" || req.status === "ready_for_review";

  return (
    <div className="p-4 md:p-6 pb-20 md:pb-6 max-w-4xl mx-auto text-white space-y-6">

      {/* Back link */}
      <Link href="/builder/3d-projects" className="inline-flex items-center gap-1.5 text-sm text-white/40 hover:text-white/70 transition-colors">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
        </svg>
        Back to 3D Projects
      </Link>

      {/* Request header card */}
      <div className="bg-[#0e0e0e] border border-white/8 rounded-2xl p-5">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            {req.title && (
              <h1 className="text-lg font-extrabold text-white mb-0.5">{req.title}</h1>
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
            <p className="text-sm font-semibold text-white/70 mt-1.5">{TYPE_LABEL[req.type]}</p>
          </div>

          <div className="flex flex-col items-end gap-2 flex-shrink-0">
            <p className="text-xs text-white/25">{formatTime(req.created_at)}</p>
            <p className="text-xs text-white/25">{req.credits_used} credit{req.credits_used !== 1 ? "s" : ""}</p>
            {canRevise && (
              <button
                onClick={() => setShowRevision(true)}
                className="px-3 py-1.5 rounded-xl bg-orange-500/10 hover:bg-orange-500/20 border border-orange-500/20 text-orange-400 text-xs font-semibold transition-colors">
                Request Revision
              </button>
            )}
          </div>
        </div>

        {req.configuration_notes && (
          <p className="text-xs text-white/40 bg-white/4 rounded-lg px-3 py-2 mt-3">
            {req.configuration_notes}
          </p>
        )}

        {/* Reference files */}
        {req.reference_files && req.reference_files.length > 0 && (
          <div className="mt-3">
            <p className="text-[10px] font-bold uppercase tracking-widest text-white/25 mb-2">Reference Files</p>
            <div className="flex flex-wrap gap-2">
              {req.reference_files.map((url, i) => {
                const isImg = /\.(jpe?g|png|gif|webp|avif|svg)(\?|$)/i.test(url);
                const name  = url.split("/").pop()?.split("?")[0] ?? `File ${i + 1}`;
                return isImg ? (
                  <a key={i} href={url} target="_blank" rel="noreferrer"
                    className="block w-20 h-16 rounded-lg overflow-hidden bg-white/5 hover:opacity-80 transition-opacity flex-shrink-0">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={url} alt={name} className="w-full h-full object-cover" />
                  </a>
                ) : (
                  <a key={i} href={url} target="_blank" rel="noreferrer" download
                    className="flex items-center gap-1.5 bg-white/5 hover:bg-white/8 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white/50 hover:text-white/80 transition-colors">
                    <svg className="w-3.5 h-3.5 flex-shrink-0 text-white/30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M18.375 12.739l-7.693 7.693a4.5 4.5 0 01-6.364-6.364l10.94-10.94A3 3 0 1119.5 7.372L8.552 18.32m.009-.01l-.01.01m5.699-9.941l-7.81 7.81a1.5 1.5 0 002.112 2.13" />
                    </svg>
                    <span className="truncate max-w-[120px]">{name}</span>
                  </a>
                );
              })}
            </div>
          </div>
        )}

        {req.status !== "delivered" && req.status !== "revision_requested" && req.status !== "completed" && (
          <PipelineSteps status={req.status} />
        )}
      </div>

      {/* Accept delivery banner — shown when admin has delivered but builder hasn't accepted yet */}
      {req.status === "delivered" && (
        <div className="border border-yellow-500/40 bg-yellow-500/6 rounded-2xl px-5 py-4">
          <div className="flex items-start gap-3">
            <span className="text-xl flex-shrink-0 mt-0.5">📦</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-yellow-300 mb-0.5">Your render has been delivered!</p>
              <p className="text-xs text-white/40 mb-3">Review the files in the chat below. Once satisfied, accept the delivery to mark this project as completed.</p>
              <button onClick={acceptDelivery} disabled={acceptingDelivery}
                className="px-5 py-2 rounded-xl bg-emerald-600/80 hover:bg-emerald-500/80 disabled:opacity-40 text-white text-sm font-bold transition-colors">
                {acceptingDelivery ? "Processing…" : "✓ Accept Delivery & Complete Project"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Completed banner */}
      {req.status === "completed" && (
        <div className="border border-emerald-500/30 bg-emerald-500/6 rounded-2xl px-5 py-4 flex items-center gap-3">
          <span className="text-xl">✅</span>
          <div>
            <p className="text-sm font-semibold text-emerald-300">Project Completed</p>
            <p className="text-xs text-white/30">You accepted the delivery. This project is now closed.</p>
          </div>
        </div>
      )}

      {/* Completion date — admin proposed, builder must respond */}
      {req.completion_date_status === "proposed" && req.proposed_completion_date && (
        <div className="border border-amber-500/40 bg-amber-500/6 rounded-2xl px-5 py-4">
          <div className="flex items-start gap-3">
            <span className="text-xl flex-shrink-0 mt-0.5">📅</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-amber-300 mb-0.5">ProPlan Studio proposed a completion date:</p>
              <p className="text-base font-bold text-white mb-3">{fmtDate(req.proposed_completion_date)}</p>
              <div className="flex gap-2 flex-wrap">
                <button onClick={handleAcceptDate} disabled={respondingDate}
                  className="px-4 py-2 rounded-xl bg-emerald-600/80 hover:bg-emerald-500/80 disabled:opacity-40 text-white text-sm font-bold transition-colors">
                  {respondingDate ? "…" : "Accept ✓"}
                </button>
                <button onClick={() => { setShowCounter(v => !v); setCounterDate(""); }} disabled={respondingDate}
                  className="px-4 py-2 rounded-xl bg-white/6 hover:bg-white/10 border border-white/12 disabled:opacity-40 text-white/60 text-sm font-semibold transition-colors">
                  Decline & Counter ✗
                </button>
              </div>
              {showCounter && (
                <div className="mt-4 p-4 bg-black/20 rounded-xl border border-white/10 space-y-3">
                  <p className="text-xs font-semibold text-white/50 uppercase tracking-wide">Propose a counter date</p>
                  <input type="date" min={new Date().toISOString().slice(0, 10)}
                    value={counterDate} onChange={e => setCounterDate(e.target.value)}
                    className="w-full bg-[#141414] border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white/80 focus:outline-none focus:ring-1 focus:ring-amber-500/50 focus:border-amber-500/40 transition-colors" />
                  <button onClick={handleCounterDate} disabled={respondingDate || !counterDate}
                    className="w-full py-2.5 rounded-xl bg-amber-500/80 hover:bg-amber-400/80 disabled:opacity-40 disabled:cursor-not-allowed text-black text-sm font-bold transition-colors">
                    {respondingDate ? "Sending…" : "Send Counter-Proposal"}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Completion date — builder counter-proposed, awaiting admin */}
      {req.completion_date_status === "counter_proposed" && req.proposed_completion_date && (
        <div className="border border-blue-500/30 bg-blue-500/6 rounded-2xl px-5 py-4">
          <div className="flex items-start gap-3">
            <span className="text-xl flex-shrink-0 mt-0.5">📅</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-blue-300 mb-0.5">Your counter-proposal is pending admin review:</p>
              <p className="text-base font-bold text-white">{fmtDate(req.proposed_completion_date)}</p>
              <p className="text-xs text-white/30 mt-1">Awaiting ProPlan Studio acceptance…</p>
            </div>
          </div>
        </div>
      )}

      {/* Countdown timer (accepted) — hide once delivered or completed */}
      {req.completion_date_status === "accepted" && req.proposed_completion_date && req.status !== "delivered" && req.status !== "completed" && (
        <CountdownTimer targetDate={req.proposed_completion_date} />
      )}

      {/* Messages FAB — mobile only */}
      <div className="md:hidden fixed bottom-6 right-6 z-40">
        <button
          onClick={() => setChatOpen(true)}
          className="relative w-14 h-14 rounded-full bg-blue-600 hover:bg-blue-500 flex items-center justify-center shadow-xl shadow-blue-600/40 transition-colors"
          aria-label="Open messages"
        >
          <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 4v-4z" />
          </svg>
          {messages.length > 0 && (
            <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">{messages.length}</span>
          )}
        </button>
      </div>

      {/* Chat backdrop — mobile only */}
      {chatOpen && <div className="fixed inset-0 bg-black/50 z-40 md:hidden" onClick={() => setChatOpen(false)} />}

      {/* Chat thread */}
      <div className={[
        "bg-[#0e0e0e] border border-white/8 flex flex-col",
        // Mobile: fixed bottom drawer
        "fixed inset-x-0 bottom-0 z-50 h-[75vh] rounded-t-2xl",
        "transform transition-transform duration-300",
        chatOpen ? "translate-y-0" : "translate-y-full",
        // Desktop: inline section
        "md:relative md:translate-y-0 md:rounded-2xl md:h-auto md:min-h-[480px]",
      ].join(" ")}>
        <div className="px-5 py-3 border-b border-white/8 flex-shrink-0 flex items-center justify-between">
          <p className="text-xs font-semibold text-white/40 uppercase tracking-wide">Messages</p>
          <button onClick={() => setChatOpen(false)} className="md:hidden w-7 h-7 flex items-center justify-center rounded-full bg-white/8 text-white/40 hover:text-white transition-colors text-lg">×</button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {messages.length === 0 && (
            <p className="text-center text-white/25 text-sm py-8">
              No messages yet. Send a message to start the conversation.
            </p>
          )}
          {messages.map(msg => (
            <MessageBubble key={msg.id} msg={msg} />
          ))}
          <div ref={bottomRef} />
        </div>

        {/* Compose */}
        <div className="border-t border-white/8 p-4 flex-shrink-0">
          {/* Pending attachments */}
          {attachments.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-3">
              {attachments.map((att, i) => (
                <AttachmentChip
                  key={i}
                  att={att}
                  onRemove={() => setAttachments(prev => prev.filter((_, j) => j !== i))}
                />
              ))}
            </div>
          )}

          {/* Upload error */}
          {uploadError && (
            <p className="text-xs text-red-400 mt-1 mb-2">{uploadError}</p>
          )}

          <form onSubmit={handleSend} className="flex items-end gap-2">
            {/* Hidden file input */}
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={handleFileSelect}
            />

            {/* Paperclip button */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              title="Attach files"
              className="flex-shrink-0 w-9 h-9 flex items-center justify-center rounded-xl bg-white/6 hover:bg-white/10 border border-white/10 text-white/40 hover:text-white/70 disabled:opacity-40 transition-colors"
            >
              {uploading ? (
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M18.375 12.739l-7.693 7.693a4.5 4.5 0 01-6.364-6.364l10.94-10.94A3 3 0 1119.5 7.372L8.552 18.32m.009-.01l-.01.01m5.699-9.941l-7.81 7.81a1.5 1.5 0 002.112 2.13" />
                </svg>
              )}
            </button>

            <textarea
              value={msgBody}
              onChange={e => setMsgBody(e.target.value)}
              onKeyDown={e => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  if (canSend) handleSend(e as unknown as React.FormEvent);
                }
              }}
              placeholder="Type a message… (Enter to send, Shift+Enter for new line)"
              rows={2}
              className="flex-1 bg-[#141414] border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white/80 placeholder-white/20 focus:outline-none focus:ring-1 focus:ring-blue-500/60 focus:border-blue-500/40 resize-none transition-colors"
            />

            <button
              type="submit"
              disabled={!canSend}
              className="flex-shrink-0 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-bold transition-colors"
            >
              {sending ? "…" : "Send"}
            </button>
          </form>
        </div>
      </div>

      {/* Revision modal */}
      {showRevision && (
        <RevisionModal
          req={req}
          onClose={() => setShowRevision(false)}
          onSubmitted={handleRevisionSubmitted}
        />
      )}
    </div>
  );
}

// ── Page Export ───────────────────────────────────────────────────────────────

export default function RenderDetailPage() {
  return (
    <Suspense fallback={<div className="p-8 text-white/20">Loading…</div>}>
      <RenderDetailContent />
    </Suspense>
  );
}
