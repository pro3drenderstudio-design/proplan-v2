"use client";

import { useEffect, useRef, useState, Suspense } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  getRenderRequestByIdAdmin,
  sendAdminMessage,
  updateRenderRequestStatus,
  proposeCompletionDate,
  RenderRequestWithBuilder,
} from "@/lib/admin-api";
import { getRenderMessages } from "@/lib/builder-api";
import { supabase } from "@/lib/supabase";
import { RenderMessage, RenderMessageAttachment, RenderRequestStatus } from "@/types/database";

export const dynamic = "force-dynamic";

// ── Constants ─────────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyQuery = any;

const STATUS_CONFIG: Record<RenderRequestStatus, { label: string; style: string; next?: RenderRequestStatus }> = {
  submitted:          { label: "Submitted",        style: "text-white/50 bg-white/6 border-white/12",              next: "in_queue"         },
  in_queue:           { label: "In Queue",          style: "text-amber-400 bg-amber-500/10 border-amber-500/20",    next: "in_production"    },
  in_production:      { label: "In Production",    style: "text-blue-400 bg-blue-500/10 border-blue-500/20",       next: "ready_for_review" },
  ready_for_review:   { label: "Ready for Review", style: "text-violet-400 bg-violet-500/10 border-violet-500/20", next: "delivered"        },
  delivered:          { label: "Delivered",        style: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20" },
  revision_requested: { label: "Revision Needed",  style: "text-orange-400 bg-orange-500/10 border-orange-500/20", next: "in_queue"         },
  completed:          { label: "Completed",         style: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20" },
};

const TYPE_LABEL: Record<string, string> = {
  exterior_elevation: "Exterior Elevation",
  interior:           "Interior Room",
  aerial:             "Aerial",
  floor_plan:         "Floor Plan",
  custom:             "Custom Angle",
};

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

function todayString() {
  return new Date().toISOString().slice(0, 10);
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
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
      <p className="text-xs font-semibold text-blue-400/70 uppercase tracking-wide mb-3">Estimated Completion</p>
      <div className="flex items-center gap-3 justify-center">
        {[
          { value: timeLeft.days,    label: "Days"  },
          { value: timeLeft.hours,   label: "Hours" },
          { value: timeLeft.minutes, label: "Mins"  },
          { value: timeLeft.seconds, label: "Secs"  },
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
  att: RenderMessageAttachment;
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
  const isAdmin    = msg.sender_type === "admin";
  const isDelivery = msg.is_delivery;

  return (
    <div className={`flex flex-col gap-1 max-w-[80%] ${isAdmin ? "items-end ml-auto" : "items-start mr-auto"}`}>
      {isDelivery && (
        <div className={`w-full px-4 py-3 rounded-2xl border border-yellow-500/30 bg-yellow-500/8 ${
          isAdmin ? "rounded-br-sm" : "rounded-bl-sm"
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
          isAdmin
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

// ── Deliver Panel ─────────────────────────────────────────────────────────────

function DeliverPanel({
  requestId,
  adminId,
  adminName,
  onDelivered,
}: {
  requestId: string;
  adminId: string;
  adminName: string;
  onDelivered: (msg: RenderMessage) => void;
}) {
  const [open,        setOpen]        = useState(false);
  const [files,       setFiles]       = useState<RenderMessageAttachment[]>([]);
  const [msgBody,     setMsgBody]     = useState("");
  const [uploading,   setUploading]   = useState(false);
  const [submitting,  setSubmitting]  = useState(false);
  const [dragOver,    setDragOver]    = useState(false);
  const fileInputRef                  = useRef<HTMLInputElement>(null);

  async function uploadFiles(rawFiles: File[]) {
    setUploading(true);
    const uploads = await Promise.all(rawFiles.map(async (file) => {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/upload/render-attachment", { method: "POST", body: fd });
      if (!res.ok) return null;
      return res.json() as Promise<RenderMessageAttachment>;
    }));
    const valid = uploads.filter(Boolean) as RenderMessageAttachment[];
    setFiles(prev => [...prev, ...valid]);
    setUploading(false);
  }

  async function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const rawFiles = Array.from(e.target.files ?? []);
    if (rawFiles.length === 0) return;
    await uploadFiles(rawFiles);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const rawFiles = Array.from(e.dataTransfer.files);
    if (rawFiles.length > 0) await uploadFiles(rawFiles);
  }

  async function handleDeliver() {
    if (files.length === 0) return;
    setSubmitting(true);
    const msg = await sendAdminMessage(requestId, adminId, adminName, msgBody || null, files, true);
    setSubmitting(false);
    if (msg) {
      onDelivered(msg);
      setOpen(false);
      setFiles([]);
      setMsgBody("");
    }
  }

  return (
    <div className="bg-[#0e0e0e] border border-white/8 rounded-2xl overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-white/3 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="text-yellow-400 font-bold text-sm">Deliver to Builder</span>
          <span className="text-xs text-white/30">Upload rendered files and mark as delivered</span>
        </div>
        <svg className={`w-4 h-4 text-white/30 transition-transform ${open ? "rotate-180" : ""}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
        </svg>
      </button>

      {open && (
        <div className="px-5 pb-5 space-y-4 border-t border-white/8 pt-4">
          {/* Drop zone */}
          <div
            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors ${
              dragOver
                ? "border-yellow-500/50 bg-yellow-500/5"
                : "border-white/12 hover:border-white/20 hover:bg-white/3"
            }`}
          >
            <svg className="w-8 h-8 mx-auto mb-2 text-white/25" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
            </svg>
            <p className="text-sm text-white/40">Drag & drop files here, or click to browse</p>
            <p className="text-xs text-white/20 mt-1">Images, PDFs, ZIPs accepted</p>
            <input ref={fileInputRef} type="file" multiple className="hidden" onChange={handleFileInput} />
          </div>

          {uploading && (
            <p className="text-xs text-yellow-400/70 text-center">Uploading…</p>
          )}

          {/* Uploaded files */}
          {files.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {files.map((f, i) => (
                <AttachmentChip
                  key={i}
                  att={f}
                  onRemove={() => setFiles(prev => prev.filter((_, j) => j !== i))}
                />
              ))}
            </div>
          )}

          {/* Optional message */}
          <div>
            <label className="block text-xs font-semibold text-white/40 mb-1.5 uppercase tracking-wide">
              Delivery Message (optional)
            </label>
            <textarea
              rows={3}
              value={msgBody}
              onChange={e => setMsgBody(e.target.value)}
              placeholder="Add a note for the builder about what's included…"
              className="w-full bg-[#141414] border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white/80 placeholder-white/20 focus:outline-none focus:ring-1 focus:ring-yellow-500/40 focus:border-yellow-500/30 resize-none transition-colors"
            />
          </div>

          <button
            onClick={handleDeliver}
            disabled={submitting || files.length === 0 || uploading}
            className="w-full py-3 rounded-xl bg-yellow-500/80 hover:bg-yellow-400/80 disabled:opacity-40 disabled:cursor-not-allowed text-black font-bold text-sm transition-colors"
          >
            {submitting ? "Marking as Delivered…" : `Mark as Delivered · ${files.length} file${files.length !== 1 ? "s" : ""}`}
          </button>
        </div>
      )}
    </div>
  );
}

// ── Propose Completion Date Panel ─────────────────────────────────────────────

function ProposeCompletionDatePanel({
  requestId,
  adminId,
  adminName,
  currentStatus,
  currentDate,
  onProposed,
  onAccepted,
}: {
  requestId: string;
  adminId: string;
  adminName: string;
  currentStatus: "none" | "proposed" | "accepted" | "declined" | "counter_proposed";
  currentDate: string | null;
  onProposed: (date: string) => void;
  onAccepted: () => void;
}) {
  const [open,        setOpen]        = useState(false);
  const [dateValue,   setDateValue]   = useState("");
  const [submitting,  setSubmitting]  = useState(false);
  const [responding,  setResponding]  = useState(false);
  const [flash,       setFlash]       = useState("");

  async function handleSend() {
    if (!dateValue) return;
    setSubmitting(true);
    const ok = await proposeCompletionDate(requestId, dateValue);
    if (ok) {
      const formatted = fmtDate(dateValue);
      await sendAdminMessage(requestId, adminId, adminName, `📅 Completion date proposed: ${formatted}`, [], false);
      onProposed(dateValue);
      setOpen(false);
      setDateValue("");
      setFlash("Proposal sent ✓");
      setTimeout(() => setFlash(""), 3000);
    }
    setSubmitting(false);
  }

  async function handleAcceptCounter() {
    if (!currentDate) return;
    setResponding(true);
    const res = await fetch(`/api/render-requests/${requestId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ completion_date_status: "accepted" }),
    });
    if (res.ok) {
      await sendAdminMessage(requestId, adminId, adminName,
        `✅ Counter-proposal accepted: ${fmtDate(currentDate)}`, [], false);
      onAccepted();
      setFlash("Counter accepted ✓");
      setTimeout(() => setFlash(""), 3000);
    }
    setResponding(false);
  }

  async function handleDeclineCounter() {
    // Admin declines and must re-propose — just open the date picker
    setOpen(true);
  }

  const isCounter = currentStatus === "counter_proposed";

  return (
    <div className={`border rounded-2xl overflow-hidden ${
      isCounter ? "bg-amber-500/6 border-amber-500/30" : "bg-[#0e0e0e] border-white/8"
    }`}>

      {/* Counter-proposal banner — admin must respond */}
      {isCounter && currentDate && (
        <div className="px-5 py-4 border-b border-amber-500/20">
          <div className="flex items-start gap-3">
            <span className="text-xl flex-shrink-0">📅</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-amber-300 mb-0.5">Builder counter-proposed a completion date:</p>
              <p className="text-base font-bold text-white mb-3">{fmtDate(currentDate)}</p>
              <div className="flex gap-2 flex-wrap">
                <button onClick={handleAcceptCounter} disabled={responding}
                  className="px-4 py-2 rounded-xl bg-emerald-600/80 hover:bg-emerald-500/80 disabled:opacity-40 text-white text-sm font-bold transition-colors">
                  {responding ? "…" : "Accept ✓"}
                </button>
                <button onClick={handleDeclineCounter} disabled={responding}
                  className="px-4 py-2 rounded-xl bg-white/6 hover:bg-white/10 border border-white/12 disabled:opacity-40 text-white/60 text-sm font-semibold transition-colors">
                  Decline & Re-propose ✗
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Header row with toggle + status badge */}
      <div className="flex items-center justify-between px-5 py-4">
        <button onClick={() => setOpen(o => !o)}
          className="flex items-center gap-2 hover:opacity-80 transition-opacity">
          <span className="text-sm">📅</span>
          <span className="text-sm font-semibold text-white/70">
            {isCounter ? "Re-propose a Date" : "Propose Completion Date"}
          </span>
          <svg className={`w-4 h-4 text-white/30 transition-transform ${open ? "rotate-180" : ""}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
          </svg>
        </button>
        <div className="flex items-center gap-2">
          {currentStatus === "proposed" && (
            <span className="text-[11px] px-2 py-0.5 rounded-full border font-semibold text-amber-400 bg-amber-500/10 border-amber-500/20">
              Awaiting builder acceptance
            </span>
          )}
          {currentStatus === "accepted" && currentDate && (
            <span className="text-[11px] px-2 py-0.5 rounded-full border font-semibold text-emerald-400 bg-emerald-500/10 border-emerald-500/20">
              Accepted · Due {new Date(currentDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
            </span>
          )}
          {currentStatus === "declined" && (
            <span className="text-[11px] px-2 py-0.5 rounded-full border font-semibold text-red-400 bg-red-500/10 border-red-500/20">
              Declined
            </span>
          )}
          {flash && (
            <span className="text-[11px] px-2 py-0.5 rounded-full border font-semibold text-emerald-400 bg-emerald-500/10 border-emerald-500/20">
              {flash}
            </span>
          )}
        </div>
      </div>

      {open && (
        <div className="px-5 pb-5 border-t border-white/8 pt-4 space-y-3">
          <label className="block text-xs font-semibold text-white/40 mb-1.5 uppercase tracking-wide">
            {isCounter ? "Your New Proposed Date" : "Proposed Completion Date"}
          </label>
          <input type="date" min={todayString()} value={dateValue}
            onChange={e => setDateValue(e.target.value)}
            className="w-full bg-[#141414] border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white/80 focus:outline-none focus:ring-1 focus:ring-blue-500/60 focus:border-blue-500/40 transition-colors" />
          <button onClick={handleSend} disabled={submitting || !dateValue}
            className="w-full py-2.5 rounded-xl bg-blue-600/80 hover:bg-blue-500/80 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-bold transition-colors">
            {submitting ? "Sending…" : isCounter ? "Send Re-Proposal" : "Send Proposal"}
          </button>
        </div>
      )}
    </div>
  );
}

// ── Main Admin Detail Content ─────────────────────────────────────────────────

function AdminRenderDetailContent() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = params.id;

  const [req,         setReq]         = useState<RenderRequestWithBuilder | null>(null);
  const [messages,    setMessages]    = useState<RenderMessage[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [msgBody,     setMsgBody]     = useState("");
  const [attachments, setAttachments] = useState<RenderMessageAttachment[]>([]);
  const [uploading,   setUploading]   = useState(false);
  const [sending,     setSending]     = useState(false);
  const [adminId,     setAdminId]     = useState<string>("");
  const [adminName,   setAdminName]   = useState<string>("Admin");
  const [advancing,   setAdvancing]   = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const bottomRef    = useRef<HTMLDivElement>(null);

  async function loadAll() {
    const [r, msgs] = await Promise.all([
      getRenderRequestByIdAdmin(id),
      getRenderMessages(id),
    ]);
    if (r) setReq(r);
    setMessages(msgs);
  }

  async function loadMessages() {
    const msgs = await getRenderMessages(id);
    setMessages(msgs);
  }

  useEffect(() => {
    // Load admin identity
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (user) {
        setAdminId(user.id);
        const { data: profile } = await (supabase as AnyQuery)
          .from("profiles").select("full_name").eq("id", user.id).single();
        setAdminName(profile?.full_name ?? "Admin");
      }
    });

    Promise.all([
      getRenderRequestByIdAdmin(id),
      getRenderMessages(id),
    ]).then(([r, msgs]) => {
      setReq(r);
      setMessages(msgs);
      setLoading(false);
    });
  }, [id]);

  // Poll for new messages + request state every 8 seconds
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
    const uploads = await Promise.all(files.map(async (file) => {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/upload/render-attachment", { method: "POST", body: fd });
      if (!res.ok) return null;
      return res.json() as Promise<RenderMessageAttachment>;
    }));
    const valid = uploads.filter(Boolean) as RenderMessageAttachment[];
    setAttachments(prev => [...prev, ...valid]);
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    const bodyTrim = msgBody.trim();
    if (!bodyTrim && attachments.length === 0) return;
    setSending(true);
    const msg = await sendAdminMessage(id, adminId, adminName, bodyTrim || null, attachments, false);
    setSending(false);
    if (msg) {
      setMessages(prev => [...prev, msg]);
      setMsgBody("");
      setAttachments([]);
    }
  }

  async function handleAdvanceStatus(next: RenderRequestStatus) {
    if (!req || advancing) return;
    setAdvancing(true);
    const ok = await updateRenderRequestStatus(req.id, next);
    setAdvancing(false);
    if (ok) setReq(prev => prev ? { ...prev, status: next } : prev);
  }

  function handleDelivered(msg: RenderMessage) {
    setMessages(prev => [...prev, msg]);
    setReq(prev => prev ? { ...prev, status: "delivered" } : prev);
  }

  function handleDateProposed(date: string) {
    setReq(prev => prev
      ? { ...prev, proposed_completion_date: date, completion_date_status: "proposed" }
      : prev
    );
    // Reload messages so the auto-sent chat message appears
    loadMessages();
  }

  function handleDateAccepted() {
    setReq(prev => prev ? { ...prev, completion_date_status: "accepted" } : prev);
    loadMessages();
  }

  if (loading) {
    return (
      <div className="h-full overflow-y-auto">
        <div className="p-6 max-w-4xl mx-auto text-white">
          <div className="h-32 bg-[#0e0e0e] rounded-2xl animate-pulse mb-4" />
          <div className="h-96 bg-[#0e0e0e] rounded-2xl animate-pulse" />
        </div>
      </div>
    );
  }

  if (!req) {
    return (
      <div className="h-full overflow-y-auto">
        <div className="p-6 max-w-4xl mx-auto text-white text-center">
          <p className="text-white/30">Render request not found.</p>
          <button onClick={() => router.push("/admin/renders")} className="mt-4 text-blue-400 text-sm">
            ← Back to Render Queue
          </button>
        </div>
      </div>
    );
  }

  const cfg = STATUS_CONFIG[req.status];
  const canSend = !sending && !uploading && (msgBody.trim().length > 0 || attachments.length > 0);

  return (
    <div className="h-full overflow-y-auto">
    <div className="p-6 max-w-4xl mx-auto text-white space-y-6">

      {/* Back link */}
      <Link href="/admin/renders" className="inline-flex items-center gap-1.5 text-sm text-white/40 hover:text-white/70 transition-colors">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
        </svg>
        Back to Render Queue
      </Link>

      {/* Request header card */}
      <div className="bg-[#0e0e0e] border border-white/8 rounded-2xl p-5">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="min-w-0">
            {req.title && (
              <h1 className="text-lg font-extrabold text-white mb-0.5">{req.title}</h1>
            )}
            <div className="flex items-center gap-2 flex-wrap mb-2">
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
            <p className="text-sm font-semibold text-white/70">{TYPE_LABEL[req.type] ?? req.type}</p>
            <div className="flex items-center gap-3 mt-1 flex-wrap text-xs text-white/35">
              <span>{req.builder_name}</span>
              {req.project_name && (
                <>
                  <span className="text-white/15">·</span>
                  <span>{req.project_name}</span>
                </>
              )}
              <span className="text-white/15">·</span>
              <span>{req.credits_used} credit{req.credits_used !== 1 ? "s" : ""}</span>
            </div>
          </div>

          <div className="flex flex-col items-end gap-2 flex-shrink-0">
            <p className="text-xs text-white/25">{formatTime(req.created_at)}</p>
            {/* Status advancement buttons */}
            {cfg.next && cfg.next !== "delivered" && (
              <button
                onClick={() => handleAdvanceStatus(cfg.next!)}
                disabled={advancing}
                className="px-3 py-1.5 rounded-xl bg-blue-600/12 hover:bg-blue-600/20 border border-blue-500/20 text-blue-400 text-xs font-semibold disabled:opacity-40 transition-colors"
              >
                {advancing ? "…" : `→ Move to ${STATUS_CONFIG[cfg.next].label}`}
              </button>
            )}
          </div>
        </div>

        {req.configuration_notes && (
          <p className="text-xs text-white/40 bg-white/4 rounded-lg px-3 py-2 mt-3">
            {req.configuration_notes}
          </p>
        )}

        {req.revision_notes && (
          <p className="text-xs text-orange-400/70 bg-orange-500/6 rounded-lg px-3 py-2 mt-2 border border-orange-500/15">
            Revision: {req.revision_notes}
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
      </div>

      {/* Propose completion date panel */}
      <ProposeCompletionDatePanel
        requestId={id}
        adminId={adminId}
        adminName={adminName}
        currentStatus={req.completion_date_status ?? "none"}
        currentDate={req.proposed_completion_date ?? null}
        onProposed={handleDateProposed}
        onAccepted={handleDateAccepted}
      />

      {/* Countdown timer — shown when completion date is accepted (hide once delivered or completed) */}
      {req.completion_date_status === "accepted" && req.proposed_completion_date && req.status !== "delivered" && req.status !== "completed" && (
        <CountdownTimer targetDate={req.proposed_completion_date} />
      )}

      {/* Deliver panel */}
      {req.status !== "delivered" && req.status !== "completed" && (
        <DeliverPanel
          requestId={id}
          adminId={adminId}
          adminName={adminName}
          onDelivered={handleDelivered}
        />
      )}

      {/* Chat thread */}
      <div className="bg-[#0e0e0e] border border-white/8 rounded-2xl flex flex-col" style={{ minHeight: "480px" }}>
        <div className="px-5 py-3 border-b border-white/8 flex-shrink-0">
          <p className="text-xs font-semibold text-white/40 uppercase tracking-wide">Messages</p>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {messages.length === 0 && (
            <p className="text-center text-white/25 text-sm py-8">
              No messages yet.
            </p>
          )}
          {messages.map(msg => (
            <MessageBubble key={msg.id} msg={msg} />
          ))}
          <div ref={bottomRef} />
        </div>

        {/* Compose */}
        <div className="border-t border-white/8 p-4 flex-shrink-0">
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

          <form onSubmit={handleSend} className="flex items-end gap-2">
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={handleFileSelect}
            />

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
    </div>
    </div>
  );
}

// ── Page Export ───────────────────────────────────────────────────────────────

export default function AdminRenderDetailPage() {
  return (
    <Suspense fallback={<div className="p-6 text-white/20">Loading…</div>}>
      <AdminRenderDetailContent />
    </Suspense>
  );
}
