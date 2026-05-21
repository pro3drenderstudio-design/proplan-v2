"use client";

import { useState, useEffect, useCallback } from "react";

// ── Types ─────────────────────────────────────────────────────────────────────
interface GeneratedComment { id: number; comment: string; }
interface Session { id?: string; post_snippet: string; style: string; generated: GeneratedComment[]; used_comment?: string; created_at: string; }
interface Persona {
  name: string; title: string; company: string; company_description: string;
  expertise_areas: string; industries: string; writing_style: string;
  personal_background: string; recent_milestones: string; hot_takes: string;
  banned_phrases: string; extra_context: string;
}

// ── Constants ─────────────────────────────────────────────────────────────────
const STYLES = [
  { key: "insight",    label: "Insight",        desc: "Add a unique angle the post missed" },
  { key: "question",   label: "Question",        desc: "Ask something that sparks dialogue" },
  { key: "founder",    label: "Founder Story",   desc: "Connect your experience to the post" },
  { key: "contrarian", label: "Contrarian",      desc: "Respectfully challenge the premise" },
  { key: "punchy",     label: "Short & Punchy",  desc: "1–2 sentences, impossible to ignore" },
];

const TONES = [
  { key: "measured", label: "Measured" },
  { key: "bold",     label: "Bold"     },
  { key: "spicy",    label: "Spicy"    },
];

const DAILY_GOAL = 20;
const LS_KEY     = "li_daily";

// ── Daily counter helpers ─────────────────────────────────────────────────────
function getDailyData(): { date: string; count: number; streak: number } {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return { date: "", count: 0, streak: 0 };
}
function incrementDaily(): { count: number; streak: number } {
  const today = new Date().toDateString();
  const prev  = getDailyData();
  const yesterday = new Date(Date.now() - 86400000).toDateString();
  let streak = prev.streak;
  let count  = prev.count;
  if (prev.date !== today) {
    count  = 1;
    streak = prev.date === yesterday ? streak + 1 : 1;
  } else {
    count += 1;
  }
  const next = { date: today, count, streak };
  try { localStorage.setItem(LS_KEY, JSON.stringify(next)); } catch { /* ignore */ }
  return { count, streak };
}

// ── Main component ────────────────────────────────────────────────────────────
export default function LinkedInPage() {
  const [tab,          setTab]          = useState<"generate" | "voice" | "history">("generate");
  const [postContent,  setPostContent]  = useState("");
  const [style,        setStyle]        = useState("insight");
  const [tone,         setTone]         = useState("measured");
  const [customAngle,  setCustomAngle]  = useState("");
  const [loading,      setLoading]      = useState(false);
  const [comments,     setComments]     = useState<GeneratedComment[]>([]);
  const [copied,       setCopied]       = useState<number | null>(null);
  const [error,        setError]        = useState("");
  const [regenIdx,     setRegenIdx]     = useState<number | null>(null);
  const [dailyCount,   setDailyCount]   = useState(0);
  const [streak,       setStreak]       = useState(0);
  const [sessions,     setSessions]     = useState<Session[]>([]);
  const [histLoading,  setHistLoading]  = useState(false);
  const [persona,      setPersona]      = useState<Persona>({
    name: "Malik Adelaja", title: "Founder", company: "ProPlan Studio",
    company_description: "", expertise_areas: "", industries: "",
    writing_style: "", personal_background: "", recent_milestones: "",
    hot_takes: "", banned_phrases: "", extra_context: "",
  });
  const [personaSaving,  setPersonaSaving]  = useState(false);
  const [personaSaved,   setPersonaSaved]   = useState(false);
  const [personaLoading, setPersonaLoading] = useState(true);

  // ── Init ────────────────────────────────────────────────────────────────────
  useEffect(() => {
    const d = getDailyData();
    const today = new Date().toDateString();
    setDailyCount(d.date === today ? d.count : 0);
    setStreak(d.streak);
  }, []);

  useEffect(() => {
    fetch("/api/admin/linkedin-persona")
      .then(r => r.json())
      .then(data => { if (data && !data.error) setPersona(data); })
      .finally(() => setPersonaLoading(false));
  }, []);

  const loadHistory = useCallback(async () => {
    setHistLoading(true);
    // Read from Supabase via a lightweight fetch
    // We reuse the generate endpoint's side-effect of writing sessions;
    // for history we query directly through a dedicated endpoint if needed.
    // For now, surface a minimal history from the API.
    try {
      const res  = await fetch("/api/admin/linkedin-sessions");
      const data = await res.json();
      if (Array.isArray(data)) setSessions(data);
    } catch { /* non-fatal */ }
    setHistLoading(false);
  }, []);

  useEffect(() => {
    if (tab === "history") loadHistory();
  }, [tab, loadHistory]);

  // ── Generate ────────────────────────────────────────────────────────────────
  async function generate() {
    if (!postContent.trim()) { setError("Paste the LinkedIn post first."); return; }
    setLoading(true);
    setError("");
    setComments([]);
    try {
      const res = await fetch("/api/admin/linkedin-comments", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ postContent, style, tone, customAngle: customAngle || undefined }),
      });
      const data = await res.json();
      if (!res.ok || data.error) { setError(data.error ?? "Generation failed"); return; }
      setComments(data.comments ?? []);
      const updated = incrementDaily();
      setDailyCount(updated.count);
      setStreak(updated.streak);
    } catch { setError("Network error — try again."); }
    finally { setLoading(false); }
  }

  async function regenSingle(idx: number) {
    if (!postContent.trim()) return;
    setRegenIdx(idx);
    try {
      const res = await fetch("/api/admin/linkedin-comments", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ postContent, style, tone, customAngle: customAngle || undefined }),
      });
      const data = await res.json();
      if (res.ok && data.comments?.length > 0) {
        const replacement = data.comments[Math.floor(Math.random() * data.comments.length)];
        setComments(prev => prev.map((c, i) => i === idx ? { ...replacement, id: c.id } : c));
      }
    } catch { /* non-fatal */ }
    finally { setRegenIdx(null); }
  }

  function copyComment(comment: string, id: number) {
    navigator.clipboard.writeText(comment).then(() => {
      setCopied(id);
      incrementDaily();
      setDailyCount(d => d + 1);
      setTimeout(() => setCopied(null), 2000);
    });
  }

  // ── Save persona ────────────────────────────────────────────────────────────
  async function savePersona() {
    setPersonaSaving(true);
    try {
      await fetch("/api/admin/linkedin-persona", {
        method:  "PUT",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(persona),
      });
      setPersonaSaved(true);
      setTimeout(() => setPersonaSaved(false), 2500);
    } catch { /* non-fatal */ }
    finally { setPersonaSaving(false); }
  }

  // ── Progress bar ─────────────────────────────────────────────────────────────
  const progress = Math.min((dailyCount / DAILY_GOAL) * 100, 100);

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="flex-1 overflow-y-auto bg-[#0c0c0c]" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>
      <style>{`
        .li-input { background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.1); border-radius: 10px; color: white; outline: none; width: 100%; padding: 10px 12px; font-size: 13px; transition: border-color 0.15s; resize: none; }
        .li-input::placeholder { color: rgba(255,255,255,0.25); }
        .li-input:focus { border-color: rgba(10,102,194,0.6); background: rgba(255,255,255,0.055); }
        .li-label { font-size: 10px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: rgba(255,255,255,0.35); margin-bottom: 8px; display: block; }
        .comment-card { background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 12px; padding: 16px; display: flex; flex-direction: column; gap: 12px; transition: border-color 0.15s; }
        .comment-card:hover { border-color: rgba(255,255,255,0.14); }
        @keyframes fadeSlideUp { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:none; } }
        .card-appear { animation: fadeSlideUp 0.25s ease-out both; }
        @keyframes pulse { 0%,100% { opacity:1; } 50% { opacity:0.4; } }
        .skeleton { background: rgba(255,255,255,0.06); border-radius: 6px; animation: pulse 1.4s ease-in-out infinite; }
      `}</style>

      <div className="max-w-5xl mx-auto px-6 py-8">

        {/* ── Header ── */}
        <div className="flex items-start justify-between mb-8 gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ background: "rgba(10,102,194,0.2)", border: "1px solid rgba(10,102,194,0.35)" }}>
                <LinkedInIcon className="w-4 h-4" style={{ color: "#0A66C2" }} />
              </div>
              <h1 className="text-xl font-bold text-white">LinkedIn Comment Studio</h1>
            </div>
            <p className="text-sm text-white/40 ml-11">AI-powered comments written in your voice</p>
          </div>

          {/* Daily stats */}
          <div className="flex items-center gap-4 flex-shrink-0">
            {streak > 1 && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg"
                style={{ background: "rgba(251,146,60,0.1)", border: "1px solid rgba(251,146,60,0.2)" }}>
                <span className="text-sm">🔥</span>
                <span className="text-xs font-bold text-orange-400">{streak}d streak</span>
              </div>
            )}
            <div className="flex flex-col items-end gap-1.5">
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-bold text-white">{dailyCount}</span>
                <span className="text-sm text-white/30">/ {DAILY_GOAL} today</span>
              </div>
              <div className="w-40 h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.08)" }}>
                <div className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${progress}%`, background: progress >= 100 ? "#22c55e" : "#0A66C2" }} />
              </div>
            </div>
          </div>
        </div>

        {/* ── Tabs ── */}
        <div className="flex gap-1 mb-7 p-1 rounded-xl w-fit"
          style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
          {[
            { key: "generate", label: "Generate" },
            { key: "voice",    label: "My Voice"  },
            { key: "history",  label: "History"   },
          ].map(t => (
            <button key={t.key} onClick={() => setTab(t.key as typeof tab)}
              className="px-4 py-1.5 rounded-lg text-sm font-semibold transition-all"
              style={tab === t.key
                ? { background: "rgba(10,102,194,0.25)", color: "#60a5fa", border: "1px solid rgba(10,102,194,0.4)" }
                : { color: "rgba(255,255,255,0.4)", border: "1px solid transparent" }}>
              {t.label}
            </button>
          ))}
        </div>

        {/* ══════════════════════════════════════════════════════════ */}
        {/* GENERATE TAB                                               */}
        {/* ══════════════════════════════════════════════════════════ */}
        {tab === "generate" && (
          <div className="space-y-8">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

              {/* Left: Input */}
              <div className="space-y-5">
                {/* Post content */}
                <div>
                  <label className="li-label">LinkedIn Post</label>
                  <textarea
                    className="li-input"
                    rows={8}
                    placeholder="Paste the LinkedIn post you want to comment on..."
                    value={postContent}
                    onChange={e => setPostContent(e.target.value)}
                  />
                  {postContent && (
                    <p className="text-[10px] text-white/20 mt-1.5 text-right">
                      {postContent.length} chars
                    </p>
                  )}
                </div>

                {/* Style */}
                <div>
                  <label className="li-label">Comment Style</label>
                  <div className="grid grid-cols-1 gap-1.5">
                    {STYLES.map(s => (
                      <button key={s.key} onClick={() => setStyle(s.key)}
                        className="flex items-center justify-between px-3.5 py-2.5 rounded-lg text-left transition-all"
                        style={style === s.key
                          ? { background: "rgba(10,102,194,0.18)", border: "1px solid rgba(10,102,194,0.45)", color: "#93c5fd" }
                          : { background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.5)" }}>
                        <span className="text-sm font-semibold">{s.label}</span>
                        <span className="text-[11px]" style={{ color: style === s.key ? "rgba(147,197,253,0.6)" : "rgba(255,255,255,0.25)" }}>
                          {s.desc}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Tone */}
                <div>
                  <label className="li-label">Tone</label>
                  <div className="flex gap-2">
                    {TONES.map(t => (
                      <button key={t.key} onClick={() => setTone(t.key)}
                        className="flex-1 py-2 rounded-lg text-sm font-semibold transition-all"
                        style={tone === t.key
                          ? { background: "rgba(10,102,194,0.18)", border: "1px solid rgba(10,102,194,0.45)", color: "#93c5fd" }
                          : { background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.4)" }}>
                        {t.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Custom angle */}
                <div>
                  <label className="li-label">Your Angle <span style={{ color: "rgba(255,255,255,0.2)", textTransform: "none", fontWeight: 400 }}>(optional)</span></label>
                  <input
                    className="li-input"
                    placeholder="Any specific point you want woven into the comments..."
                    value={customAngle}
                    onChange={e => setCustomAngle(e.target.value)}
                  />
                </div>

                {/* Generate button */}
                <button
                  onClick={generate}
                  disabled={loading || !postContent.trim()}
                  className="w-full py-3 rounded-xl text-sm font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  style={{ background: "rgba(10,102,194,0.85)", border: "1px solid rgba(10,102,194,0.6)", color: "white", boxShadow: "0 4px 20px rgba(10,102,194,0.3)" }}>
                  {loading ? (
                    <>
                      <span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <SparkleIcon className="w-4 h-4" />
                      Generate 4 Comments
                    </>
                  )}
                </button>

                {error && (
                  <p className="text-xs text-red-400 px-1">{error}</p>
                )}
              </div>

              {/* Right: Generated comments */}
              <div className="space-y-3">
                <div className="flex items-center justify-between mb-1">
                  <label className="li-label" style={{ margin: 0 }}>
                    Generated Comments
                    {comments.length > 0 && (
                      <span className="ml-2 text-blue-400/60 normal-case font-normal">— click to copy</span>
                    )}
                  </label>
                  {comments.length > 0 && (
                    <button onClick={generate} disabled={loading}
                      className="flex items-center gap-1.5 text-[11px] text-white/30 hover:text-white/60 transition-colors">
                      <RefreshIcon className="w-3 h-3" />
                      Regen all
                    </button>
                  )}
                </div>

                {/* Skeletons while loading */}
                {loading && Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="comment-card">
                    <div className="space-y-2">
                      <div className="skeleton h-3 rounded" style={{ width: "100%", animationDelay: `${i * 0.1}s` }} />
                      <div className="skeleton h-3 rounded" style={{ width: "85%", animationDelay: `${i * 0.1 + 0.05}s` }} />
                      <div className="skeleton h-3 rounded" style={{ width: "70%", animationDelay: `${i * 0.1 + 0.1}s` }} />
                    </div>
                    <div className="skeleton h-7 rounded-lg w-20" style={{ animationDelay: `${i * 0.1 + 0.15}s` }} />
                  </div>
                ))}

                {/* Comment cards */}
                {!loading && comments.map((c, i) => (
                  <div key={c.id} className="comment-card card-appear" style={{ animationDelay: `${i * 0.06}s` }}>
                    {/* Number badge */}
                    <div className="flex items-start gap-2.5">
                      <span className="flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold mt-0.5"
                        style={{ background: "rgba(10,102,194,0.2)", color: "#60a5fa", border: "1px solid rgba(10,102,194,0.3)" }}>
                        {i + 1}
                      </span>
                      <p className="text-sm text-white/80 leading-relaxed flex-1">{c.comment}</p>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => copyComment(c.comment, c.id)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                        style={copied === c.id
                          ? { background: "rgba(34,197,94,0.15)", border: "1px solid rgba(34,197,94,0.35)", color: "#4ade80" }
                          : { background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.6)" }}>
                        {copied === c.id ? (
                          <><CheckIcon className="w-3 h-3" /> Copied</>
                        ) : (
                          <><CopyIcon className="w-3 h-3" /> Copy</>
                        )}
                      </button>
                      <button
                        onClick={() => regenSingle(i)}
                        disabled={regenIdx === i}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs text-white/30 hover:text-white/60 transition-colors disabled:opacity-40"
                        style={{ border: "1px solid rgba(255,255,255,0.07)" }}>
                        <RefreshIcon className={`w-3 h-3 ${regenIdx === i ? "animate-spin" : ""}`} />
                        Regen
                      </button>
                      <span className="ml-auto text-[10px] text-white/20">
                        {c.comment.split(" ").length}w · {c.comment.length}c
                      </span>
                    </div>
                  </div>
                ))}

                {/* Empty state */}
                {!loading && comments.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-16 text-center"
                    style={{ border: "1px dashed rgba(255,255,255,0.08)", borderRadius: 12 }}>
                    <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-4"
                      style={{ background: "rgba(10,102,194,0.1)", border: "1px solid rgba(10,102,194,0.2)" }}>
                      <SparkleIcon className="w-5 h-5 text-blue-500/60" />
                    </div>
                    <p className="text-sm text-white/25">Paste a post and hit Generate</p>
                    <p className="text-xs text-white/15 mt-1">4 variations will appear here</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════ */}
        {/* MY VOICE TAB                                               */}
        {/* ══════════════════════════════════════════════════════════ */}
        {tab === "voice" && (
          <div className="max-w-2xl space-y-6">
            <div className="p-4 rounded-xl text-sm text-blue-300/70 leading-relaxed"
              style={{ background: "rgba(10,102,194,0.08)", border: "1px solid rgba(10,102,194,0.2)" }}>
              Everything here gets injected into the AI prompt. The more context you add, the more
              the comments sound like <em>you</em> specifically — not a generic founder.
            </div>

            {personaLoading ? (
              <div className="space-y-4">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="skeleton h-10 rounded-xl" />
                ))}
              </div>
            ) : (
              <div className="space-y-5">
                {/* Core identity */}
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-white/25 mb-3">Identity</p>
                  <div className="grid grid-cols-3 gap-3">
                    {(["name", "title", "company"] as const).map(field => (
                      <div key={field}>
                        <label className="li-label">{field}</label>
                        <input className="li-input" value={persona[field]}
                          onChange={e => setPersona(p => ({ ...p, [field]: e.target.value }))} />
                      </div>
                    ))}
                  </div>
                </div>

                {/* Company description */}
                <div>
                  <label className="li-label">What your company does</label>
                  <textarea className="li-input" rows={3}
                    placeholder="Describe ProPlan Studio — what you build, who for, why it matters..."
                    value={persona.company_description}
                    onChange={e => setPersona(p => ({ ...p, company_description: e.target.value }))} />
                </div>

                {/* Expertise + Industries */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="li-label">Expertise Areas</label>
                    <input className="li-input"
                      placeholder="PropTech, SaaS, 3D Visualization..."
                      value={persona.expertise_areas}
                      onChange={e => setPersona(p => ({ ...p, expertise_areas: e.target.value }))} />
                    <p className="text-[10px] text-white/20 mt-1">Comma-separated</p>
                  </div>
                  <div>
                    <label className="li-label">Industries You Comment In</label>
                    <input className="li-input"
                      placeholder="Home Builders, PropTech, SaaS..."
                      value={persona.industries}
                      onChange={e => setPersona(p => ({ ...p, industries: e.target.value }))} />
                    <p className="text-[10px] text-white/20 mt-1">Comma-separated</p>
                  </div>
                </div>

                {/* Personal background */}
                <div>
                  <label className="li-label">Personal Background</label>
                  <textarea className="li-input" rows={2}
                    placeholder="Origin story, education, how you got here — gives the AI personal depth to draw from..."
                    value={persona.personal_background}
                    onChange={e => setPersona(p => ({ ...p, personal_background: e.target.value }))} />
                </div>

                {/* Recent milestones */}
                <div>
                  <label className="li-label">Recent Milestones / News <span style={{ color: "rgba(255,255,255,0.2)", textTransform: "none", fontWeight: 400 }}>— update this often</span></label>
                  <textarea className="li-input" rows={2}
                    placeholder="Just launched interactive site maps, hit X builder clients, closed a round, shipped a feature..."
                    value={persona.recent_milestones}
                    onChange={e => setPersona(p => ({ ...p, recent_milestones: e.target.value }))} />
                </div>

                {/* Hot takes */}
                <div>
                  <label className="li-label">Strong Beliefs / Hot Takes</label>
                  <textarea className="li-input" rows={3}
                    placeholder="Things you genuinely believe about the industry that most people don't say out loud. The AI will lean on these for Contrarian style comments..."
                    value={persona.hot_takes}
                    onChange={e => setPersona(p => ({ ...p, hot_takes: e.target.value }))} />
                </div>

                {/* Writing style */}
                <div>
                  <label className="li-label">Writing Style Notes</label>
                  <textarea className="li-input" rows={2}
                    placeholder="e.g. Direct and confident, never hedge, prefer short sentences, avoid corporate jargon, sometimes use a question at the end..."
                    value={persona.writing_style}
                    onChange={e => setPersona(p => ({ ...p, writing_style: e.target.value }))} />
                </div>

                {/* Banned phrases */}
                <div>
                  <label className="li-label">Banned Phrases</label>
                  <input className="li-input"
                    placeholder="Great post, This resonates, Couldn't agree more..."
                    value={persona.banned_phrases}
                    onChange={e => setPersona(p => ({ ...p, banned_phrases: e.target.value }))} />
                  <p className="text-[10px] text-white/20 mt-1">The AI will never use these — comma-separated</p>
                </div>

                {/* Extra context */}
                <div>
                  <label className="li-label">Extra Context <span style={{ color: "rgba(255,255,255,0.2)", textTransform: "none", fontWeight: 400 }}>— catch-all, add anything</span></label>
                  <textarea className="li-input" rows={4}
                    placeholder="Anything else the AI should know about you. Clients you work with, values you hold, things happening in your world right now, people you admire, anything..."
                    value={persona.extra_context}
                    onChange={e => setPersona(p => ({ ...p, extra_context: e.target.value }))} />
                </div>

                {/* Save */}
                <button onClick={savePersona} disabled={personaSaving}
                  className="px-6 py-2.5 rounded-xl text-sm font-bold transition-all disabled:opacity-50 flex items-center gap-2"
                  style={personaSaved
                    ? { background: "rgba(34,197,94,0.15)", border: "1px solid rgba(34,197,94,0.35)", color: "#4ade80" }
                    : { background: "rgba(10,102,194,0.85)", border: "1px solid rgba(10,102,194,0.5)", color: "white", boxShadow: "0 4px 16px rgba(10,102,194,0.25)" }}>
                  {personaSaving ? (
                    <><span className="w-3.5 h-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin" /> Saving...</>
                  ) : personaSaved ? (
                    <><CheckIcon className="w-4 h-4" /> Saved</>
                  ) : (
                    "Save Voice Profile"
                  )}
                </button>
              </div>
            )}
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════ */}
        {/* HISTORY TAB                                                */}
        {/* ══════════════════════════════════════════════════════════ */}
        {tab === "history" && (
          <div className="max-w-2xl space-y-3">
            {histLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="skeleton h-16 rounded-xl" />
              ))
            ) : sessions.length === 0 ? (
              <div className="text-center py-16 text-white/25 text-sm">
                No history yet — generate your first comments to see them here.
              </div>
            ) : (
              sessions.map((s, i) => (
                <div key={i} className="comment-card">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full"
                          style={{ background: "rgba(10,102,194,0.15)", color: "#60a5fa", border: "1px solid rgba(10,102,194,0.25)" }}>
                          {s.style}
                        </span>
                        <span className="text-[10px] text-white/25">
                          {new Date(s.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </div>
                      <p className="text-xs text-white/40 truncate">{s.post_snippet}</p>
                      {s.used_comment && (
                        <p className="text-xs text-white/55 mt-2 leading-relaxed border-l-2 pl-3 border-blue-500/40 italic">
                          {s.used_comment}
                        </p>
                      )}
                    </div>
                    <span className="text-[10px] text-white/20 flex-shrink-0">
                      {s.generated?.length ?? 0} generated
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Icons ─────────────────────────────────────────────────────────────────────
function LinkedInIcon({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg className={className} style={style} viewBox="0 0 24 24" fill="currentColor">
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
    </svg>
  );
}
function SparkleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456z" />
    </svg>
  );
}
function CopyIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
    </svg>
  );
}
function CheckIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  );
}
function RefreshIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
    </svg>
  );
}
