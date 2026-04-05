"use client";

import { useEffect, useRef, useState, Suspense } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { ProjectMessage, ProjectMessageAttachment, RequestCategory } from "@/types/database";

export const dynamic = "force-dynamic";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyQuery = any;

const STATUS_STYLE: Record<string, string> = {
  pending_review: "text-amber-400 bg-amber-500/10 border-amber-500/20",
  in_development: "text-blue-400 bg-blue-500/10 border-blue-500/20",
  in_review:      "text-violet-400 bg-violet-500/10 border-violet-500/20",
  live:           "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
  archived:       "text-white/30 bg-white/5 border-white/10",
};
const STATUS_LABEL: Record<string, string> = {
  pending_review: "Pending Review",
  in_development: "In Development",
  in_review:      "In Review",
  live:           "Live",
  archived:       "Archived",
};
const PIPELINE: { status: string; label: string }[] = [
  { status: "pending_review", label: "Request Received" },
  { status: "in_development", label: "In Development"  },
  { status: "in_review",      label: "In Review"       },
  { status: "live",           label: "Live"            },
];

function fmtTime(dateStr: string) {
  return new Date(dateStr).toLocaleString("en-US", {
    month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
  });
}
function isImg(mime: string) { return mime.startsWith("image/"); }

function PipelineSteps({ status }: { status: string }) {
  const currentIdx = PIPELINE.findIndex(p => p.status === status);
  return (
    <div className="mt-4">
      <div className="flex items-center gap-0">
        {PIPELINE.map((step, i) => {
          const done   = i < currentIdx;
          const active = i === currentIdx;
          return (
            <div key={step.status} className="flex-1 flex flex-col items-center gap-1.5">
              <div className="flex items-center w-full">
                {i > 0 && <div className={`flex-1 h-0.5 ${done || active ? "bg-blue-500" : "bg-white/8"}`} />}
                <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 border-2 ${
                  done   ? "bg-blue-500 border-blue-500" :
                  active ? "bg-blue-400 border-blue-400" :
                           "bg-transparent border-white/15"
                }`} />
                {i < PIPELINE.length - 1 && <div className={`flex-1 h-0.5 ${done ? "bg-blue-500" : "bg-white/8"}`} />}
              </div>
              <p className={`text-[10px] font-medium text-center leading-tight ${active ? "text-blue-400" : done ? "text-white/50" : "text-white/20"}`}>
                {step.label}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

interface ProjectDetail {
  id: string; name: string; status: string;
  home_type: string | null; description: string | null;
  beds: number; baths: number; floors: number | null; sqft: number | null;
  created_at: string;
}

interface ProjectRequestDetail {
  id: string;
  project_name: string;
  square_footage: number | null;
  budget_range: string | null;
  starting_price: number | null;
  categories_config: RequestCategory[] | null;
}

function BuilderProjectRequestContent() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id     = params.id;

  const [project,     setProject]     = useState<ProjectDetail | null>(null);
  const [request,     setRequest]     = useState<ProjectRequestDetail | null>(null);
  const [messages,    setMessages]    = useState<ProjectMessage[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [msgBody,     setMsgBody]     = useState("");
  const [attachments, setAttachments] = useState<ProjectMessageAttachment[]>([]);
  const [uploading,   setUploading]   = useState(false);
  const [sending,     setSending]     = useState(false);
  const [builderId,   setBuilderId]   = useState("");
  const [senderName,  setSenderName]  = useState("Builder");

  const fileInputRef = useRef<HTMLInputElement>(null);
  const bottomRef    = useRef<HTMLDivElement>(null);

  async function loadAll() {
    const [{ data: proj }, msgRes] = await Promise.all([
      (supabase as AnyQuery).from("projects").select("*").eq("id", id).single(),
      fetch(`/api/project-messages/${id}`),
    ]);
    if (proj) setProject(proj);
    if (msgRes.ok) {
      const msgs = await msgRes.json();
      setMessages(Array.isArray(msgs) ? msgs : []);
    }
  }

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return;
      const { data: profile } = await (supabase as AnyQuery)
        .from("profiles").select("full_name, builder_id").eq("id", user.id).single();
      setSenderName(profile?.full_name ?? "Builder");
      setBuilderId(profile?.builder_id ?? user.id);
    });

    Promise.all([
      (supabase as AnyQuery).from("projects").select("*").eq("id", id).single(),
      fetch(`/api/project-messages/${id}`).then(r => r.ok ? r.json() : []),
      (supabase as AnyQuery).from("project_requests").select("*").eq("project_name", id).maybeSingle(),
    ]).then(([{ data: proj }, msgs, { data: req }]) => {
      setProject(proj);
      setMessages(Array.isArray(msgs) ? msgs : []);
      // Try to match request by project name after we have project
      if (proj) {
        (supabase as AnyQuery)
          .from("project_requests").select("*").eq("project_name", proj.name).maybeSingle()
          .then(({ data: r }: { data: ProjectRequestDetail | null }) => setRequest(r));
      }
      setLoading(false);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    const t = setInterval(loadAll, 8000);
    return () => clearInterval(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    setUploading(true);
    const results = await Promise.all(files.map(async file => {
      const fd = new FormData(); fd.append("file", file);
      const res = await fetch("/api/upload/render-attachment", { method: "POST", body: fd });
      return res.ok ? res.json() as Promise<ProjectMessageAttachment> : null;
    }));
    setAttachments(prev => [...prev, ...(results.filter(Boolean) as ProjectMessageAttachment[])]);
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    const bodyTrim = msgBody.trim();
    if (!bodyTrim && !attachments.length) return;
    setSending(true);
    const res = await fetch(`/api/project-messages/${id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sender_type: "builder",
        sender_id:   builderId,
        sender_name: senderName,
        body:        bodyTrim || null,
        attachments,
      }),
    });
    if (res.ok) {
      const newMsg = await res.json() as ProjectMessage;
      setMessages(prev => [...prev, newMsg]);
      setMsgBody(""); setAttachments([]);
    }
    setSending(false);
  }

  const canSend = !sending && !uploading && (msgBody.trim().length > 0 || attachments.length > 0);

  if (loading) return (
    <div className="p-6 grid grid-cols-[1fr_380px] gap-6">
      <div className="space-y-4">
        <div className="h-32 bg-[#0e0e0e] rounded-2xl animate-pulse" />
        <div className="h-24 bg-[#0e0e0e] rounded-2xl animate-pulse" />
      </div>
      <div className="h-[600px] bg-[#0e0e0e] rounded-2xl animate-pulse" />
    </div>
  );

  if (!project) return (
    <div className="p-8 text-white text-center">
      <p className="text-white/30">Project not found.</p>
      <button onClick={() => router.push("/builder/projects")} className="mt-4 text-blue-400 text-sm">
        ← Back to Projects
      </button>
    </div>
  );

  const status = project.status ?? "pending_review";

  return (
    <div className="text-white h-full">

      {/* Back link + title bar */}
      <div className="px-6 pt-5 pb-4 border-b border-white/8">
        <Link href="/builder/projects"
          className="inline-flex items-center gap-1.5 text-xs text-white/35 hover:text-white/60 transition-colors mb-3">
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18"/>
          </svg>
          Back to Projects
        </Link>
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-extrabold text-white">{project.name}</h1>
          <span className={`text-[11px] px-2.5 py-0.5 rounded-full border font-semibold flex-shrink-0 ${STATUS_STYLE[status] ?? STATUS_STYLE.pending_review}`}>
            {STATUS_LABEL[status] ?? status}
          </span>
        </div>
      </div>

      {/* Two-column body */}
      <div className="grid grid-cols-[1fr_400px] gap-0 h-[calc(100%-80px)]">

        {/* ── Left: Project Info ───────────────────────────────────────── */}
        <div className="overflow-y-auto p-6 space-y-5 border-r border-white/8">

          {/* Pipeline */}
          <div className="bg-[#0e0e0e] border border-white/8 rounded-2xl p-5">
            <p className="text-[10px] font-bold uppercase tracking-widest text-white/30 mb-1">Pipeline Status</p>
            <PipelineSteps status={status} />
          </div>

          {/* Specs */}
          <div className="bg-[#0e0e0e] border border-white/8 rounded-2xl p-5">
            <p className="text-[10px] font-bold uppercase tracking-widest text-white/30 mb-3">Project Details</p>
            <div className="grid grid-cols-2 gap-3">
              {[
                ["Home Type",      project.home_type?.replace(/_/g, " ") ?? "—"],
                ["Bedrooms",       project.beds ?? "—"],
                ["Bathrooms",      project.baths ?? "—"],
                ["Floors",         project.floors ?? "—"],
                ["Square Footage", project.sqft ? `${Number(project.sqft).toLocaleString()} sqft` : "—"],
                ["Starting Price", request?.starting_price ? `$${Number(request.starting_price).toLocaleString()}` : "—"],
                ["Budget Range",   request?.budget_range ?? "—"],
                ["Submitted",      new Date(project.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })],
              ].map(([k, v]) => (
                <div key={k} className="flex flex-col gap-0.5">
                  <p className="text-[10px] text-white/25 uppercase tracking-wide font-medium">{k}</p>
                  <p className="text-sm text-white/70 capitalize">{String(v)}</p>
                </div>
              ))}
            </div>
            {project.description && (
              <div className="mt-4 pt-4 border-t border-white/8">
                <p className="text-[10px] font-bold uppercase tracking-widest text-white/25 mb-1.5">Description</p>
                <p className="text-sm text-white/55 leading-relaxed">{project.description}</p>
              </div>
            )}
          </div>

          {/* Requested Categories */}
          {request?.categories_config && request.categories_config.length > 0 && (
            <div className="bg-[#0e0e0e] border border-white/8 rounded-2xl p-5">
              <p className="text-[10px] font-bold uppercase tracking-widest text-white/30 mb-3">Requested Categories</p>
              <div className="space-y-4">
                {request.categories_config.map((cat, i) => (
                  <div key={i}>
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-sm font-semibold text-white/80">{cat.name}</p>
                      <span className="text-[10px] px-2 py-0.5 bg-white/6 border border-white/10 rounded-full text-white/35 capitalize">{cat.phase}</span>
                    </div>
                    {cat.options.length > 0 && (
                      <div className="space-y-1 pl-3 border-l border-white/8">
                        {cat.options.map((opt, j) => (
                          <div key={j} className="flex items-center justify-between text-xs">
                            <span className="text-white/55">{opt.name}</span>
                            {opt.price > 0 && <span className="text-white/35">+${opt.price.toLocaleString()}</span>}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── Right: Chat ──────────────────────────────────────────────── */}
        <div className="flex flex-col bg-[#0a0a0a]">
          {/* Chat header */}
          <div className="px-5 py-3.5 border-b border-white/8 flex-shrink-0">
            <p className="text-xs font-bold text-white/50 uppercase tracking-wide">Messages · ProPlan Studio Team</p>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            {messages.length === 0 && (
              <p className="text-center text-white/25 text-sm py-10">
                No messages yet. Use this thread to communicate with our team.
              </p>
            )}
            {messages.map(msg => {
              const isBuilder = msg.sender_type === "builder";
              const imgs  = msg.attachments.filter(a => isImg(a.type));
              const files = msg.attachments.filter(a => !isImg(a.type));
              return (
                <div key={msg.id} className={`flex flex-col gap-1 max-w-[85%] ${isBuilder ? "items-end ml-auto" : "items-start mr-auto"}`}>
                  <div className={`px-4 py-3 rounded-2xl ${
                    isBuilder
                      ? "bg-blue-600/80 text-white rounded-br-sm"
                      : "bg-[#1a1a1a] border border-white/10 text-white/85 rounded-bl-sm"
                  }`}>
                    {msg.body && <p className="text-sm whitespace-pre-wrap">{msg.body}</p>}
                    {imgs.length > 0 && (
                      <div className="grid grid-cols-3 gap-1.5 mt-2">
                        {imgs.map((att, i) => (
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
                        className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white/60 mt-1 hover:text-white/80 transition-colors">
                        <svg className="w-4 h-4 flex-shrink-0 text-white/30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                        </svg>
                        <span className="truncate">{att.name}</span>
                        <span className="ml-auto text-white/25 flex-shrink-0">{(att.size / 1024).toFixed(0)}KB</span>
                      </a>
                    ))}
                  </div>
                  <p className="text-[10px] text-white/25 px-1">{msg.sender_name} · {fmtTime(msg.created_at)}</p>
                </div>
              );
            })}
            <div ref={bottomRef} />
          </div>

          {/* Attachments preview */}
          {attachments.length > 0 && (
            <div className="px-4 pt-3 flex flex-wrap gap-2 border-t border-white/8">
              {attachments.map((att, i) => (
                <div key={i} className="flex items-center gap-1.5 bg-white/8 border border-white/10 rounded-lg px-2 py-1 text-xs text-white/60 max-w-[150px]">
                  <span className="truncate">{att.name}</span>
                  <button onClick={() => setAttachments(prev => prev.filter((_, j) => j !== i))}
                    className="text-white/30 hover:text-white/70 flex-shrink-0">×</button>
                </div>
              ))}
            </div>
          )}

          {/* Input */}
          <div className="p-4 border-t border-white/8 flex-shrink-0">
            <form onSubmit={handleSend} className="flex items-end gap-2">
              <input ref={fileInputRef} type="file" multiple className="hidden" onChange={handleFileSelect} />
              <button type="button" onClick={() => fileInputRef.current?.click()} disabled={uploading}
                title="Attach files"
                className="flex-shrink-0 w-9 h-9 flex items-center justify-center rounded-xl bg-white/6 hover:bg-white/10 border border-white/10 text-white/40 hover:text-white/70 disabled:opacity-40 transition-colors">
                {uploading ? (
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                  </svg>
                ) : (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M18.375 12.739l-7.693 7.693a4.5 4.5 0 01-6.364-6.364l10.94-10.94A3 3 0 1119.5 7.372L8.552 18.32m.009-.01l-.01.01m5.699-9.941l-7.81 7.81a1.5 1.5 0 002.112 2.13"/>
                  </svg>
                )}
              </button>
              <textarea
                value={msgBody}
                onChange={e => setMsgBody(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); if (canSend) handleSend(e as unknown as React.FormEvent); } }}
                placeholder="Message ProPlan Studio… (Enter to send)"
                rows={2}
                className="flex-1 bg-[#141414] border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white/80 placeholder-white/20 focus:outline-none focus:ring-1 focus:ring-blue-500/60 focus:border-blue-500/40 resize-none transition-colors"
              />
              <button type="submit" disabled={!canSend}
                className="flex-shrink-0 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-bold transition-colors">
                {sending ? "…" : "Send"}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function BuilderProjectRequestPage() {
  return (
    <Suspense fallback={<div className="p-8 text-white/20">Loading…</div>}>
      <BuilderProjectRequestContent />
    </Suspense>
  );
}
