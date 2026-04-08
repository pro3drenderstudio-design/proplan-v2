"use client";

import { useEffect, useState, useMemo } from "react";
import { getLeads, Lead } from "@/lib/builder-api";
import { getBuilderProjects } from "@/lib/builder-api";
import { Project } from "@/types/database";

// ── SVG Line Chart ────────────────────────────────────────────────────────────
function LineChart({ data }: { data: { label: string; value: number }[] }) {
  const W = 600, H = 120, PAD = { t: 10, r: 20, b: 24, l: 40 };
  const iW = W - PAD.l - PAD.r;
  const iH = H - PAD.t - PAD.b;
  const max = Math.max(...data.map(d => d.value), 1);
  const pts = data.map((d, i) => ({
    x: PAD.l + (i / Math.max(data.length - 1, 1)) * iW,
    y: PAD.t + iH - (d.value / max) * iH,
  }));
  const path = pts.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
  const fill = `${path} L ${pts[pts.length - 1].x} ${PAD.t + iH} L ${PAD.l} ${PAD.t + iH} Z`;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-full">
      <defs>
        <linearGradient id="lg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.25" />
          <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
        </linearGradient>
      </defs>
      {[0, 0.5, 1].map(t => (
        <line key={t} x1={PAD.l} y1={PAD.t + iH * (1 - t)} x2={PAD.l + iW} y2={PAD.t + iH * (1 - t)}
          stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
      ))}
      <path d={fill} fill="url(#lg)" />
      <path d={path} fill="none" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      {pts.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r="3" fill="#0e0e0e" stroke="#3b82f6" strokeWidth="2" />
      ))}
      {data.map((d, i) => i % Math.ceil(data.length / 6) === 0 && (
        <text key={i} x={pts[i].x} y={H - 4} textAnchor="middle" fontSize="9" fill="rgba(255,255,255,0.25)">{d.label}</text>
      ))}
      {[0, max].map((v, i) => (
        <text key={i} x={PAD.l - 4} y={i === 0 ? PAD.t + iH : PAD.t + 4} textAnchor="end" fontSize="9" fill="rgba(255,255,255,0.25)">{v}</text>
      ))}
    </svg>
  );
}

// ── Horizontal bar chart ──────────────────────────────────────────────────────
function BarChart({ data }: { data: { label: string; value: number; color?: string }[] }) {
  const max = Math.max(...data.map(d => d.value), 1);
  return (
    <div className="space-y-3">
      {data.map((d, i) => (
        <div key={i}>
          <div className="flex justify-between text-xs mb-1">
            <span className="text-white/50 truncate max-w-[70%]">{d.label}</span>
            <span className="font-semibold text-white/70">{d.value}</span>
          </div>
          <div className="h-2 bg-white/6 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{ width: `${(d.value / max) * 100}%`, backgroundColor: d.color ?? "#3b82f6" }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Funnel ────────────────────────────────────────────────────────────────────
function Funnel({ steps }: { steps: { label: string; count: number; color: string }[] }) {
  const max = steps[0]?.count || 1;
  return (
    <div className="space-y-2">
      {steps.map((step, i) => (
        <div key={i} className="flex items-center gap-3">
          <div className="w-24 text-right text-xs text-white/35 flex-shrink-0">{step.label}</div>
          <div className="flex-1 h-8 bg-white/5 rounded-lg overflow-hidden">
            <div
              className="h-full flex items-center px-3 rounded-lg transition-all duration-700"
              style={{ width: `${(step.count / max) * 100}%`, backgroundColor: step.color }}
            >
              <span className="text-xs font-semibold text-white whitespace-nowrap">{step.count}</span>
            </div>
          </div>
          {i > 0 && (
            <span className="text-xs text-white/30 w-10 flex-shrink-0">
              {steps[i - 1].count > 0 ? `${Math.round((step.count / steps[i - 1].count) * 100)}%` : "—"}
            </span>
          )}
          {i === 0 && <span className="w-10" />}
        </div>
      ))}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function AnalyticsPage() {
  const [leads,    setLeads]    = useState<Lead[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [range,    setRange]    = useState<"7d" | "30d" | "90d">("30d");

  useEffect(() => {
    Promise.all([getLeads(), getBuilderProjects()]).then(([l, p]) => {
      setLeads(l);
      setProjects(p);
      setLoading(false);
    });
  }, []);

  const leadsOverTime = useMemo(() => {
    const days = range === "7d" ? 7 : range === "30d" ? 30 : 90;
    const buckets: Record<string, number> = {};
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      const key = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
      buckets[key] = 0;
    }
    for (const lead of leads) {
      const d = new Date(lead.created_at);
      const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - days);
      if (d >= cutoff) {
        const key = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
        if (key in buckets) buckets[key]++;
      }
    }
    return Object.entries(buckets).map(([label, value]) => ({ label, value }));
  }, [leads, range]);

  const totalValue     = leads.reduce((s, l) => s + l.total_value, 0);
  const avgValue       = leads.length ? totalValue / leads.length : 0;
  const converted      = leads.filter(l => l.status === "converted").length;
  const conversionRate = leads.length ? Math.round((converted / leads.length) * 100) : 0;

  const statusCounts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const l of leads) c[l.status] = (c[l.status] ?? 0) + 1;
    return c;
  }, [leads]);

  const funnelSteps = [
    { label: "Total Leads",  count: leads.length, color: "#3b82f6" },
    { label: "Contacted",    count: leads.filter(l => l.status !== "new" && l.status !== "lost").length, color: "#8b5cf6" },
    { label: "Qualified",    count: leads.filter(l => l.status === "qualified" || l.status === "converted").length, color: "#f59e0b" },
    { label: "Converted",    count: converted, color: "#22c55e" },
  ];

  function fmt(n: number) {
    return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
  }

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto">

      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1
            className="text-2xl font-extrabold text-white tracking-tight"
            style={{ fontFamily: "var(--font-syne), sans-serif" }}
          >
            Analytics
          </h1>
          <p className="text-sm text-white/30 mt-0.5">Performance overview for your configurators.</p>
        </div>
        <div className="flex gap-1 p-1 bg-white/4 border border-white/8 rounded-xl">
          {(["7d", "30d", "90d"] as const).map(r => (
            <button key={r} onClick={() => setRange(r)}
              className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-all ${
                range === r
                  ? "bg-[#141414] shadow-sm text-white border border-white/10"
                  : "text-white/30 hover:text-white/60"
              }`}>
              {r === "7d" ? "7 days" : r === "30d" ? "30 days" : "90 days"}
            </button>
          ))}
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {[
          { label: "Configurator Views", value: "—",                  sub: "Tracking coming soon",         accent: "text-white/30"    },
          { label: "Total Leads",        value: String(leads.length), sub: `Last ${range}`,                 accent: "text-blue-400"    },
          { label: "Conversion Rate",    value: `${conversionRate}%`, sub: `${converted} converted`,         accent: "text-emerald-400" },
          { label: "Avg Config Value",   value: avgValue ? fmt(avgValue) : "—", sub: "Per configuration", accent: "text-violet-400"  },
        ].map(s => (
          <div key={s.label} className="bg-[#0e0e0e] rounded-2xl border border-white/8 p-5 hover:border-white/14 transition-colors">
            <p className="text-[10px] font-semibold text-white/25 uppercase tracking-widest mb-3">{s.label}</p>
            <p
              className={`text-3xl font-extrabold tracking-tight mb-1 ${s.accent}`}
              style={{ fontFamily: "var(--font-syne), sans-serif" }}
            >
              {s.value}
            </p>
            <p className="text-xs text-white/25">{s.sub}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-5">

        {/* Leads over time */}
        <div className="md:col-span-2 bg-[#0e0e0e] rounded-2xl border border-white/8 p-5">
          <h2
            className="font-bold text-white text-sm mb-4"
            style={{ fontFamily: "var(--font-syne), sans-serif" }}
          >
            Leads Over Time
          </h2>
          {loading ? (
            <div className="h-32 flex items-center justify-center text-white/25 text-sm">Loading…</div>
          ) : leads.length === 0 ? (
            <div className="h-32 flex items-center justify-center text-white/25 text-sm">No leads data yet.</div>
          ) : (
            <div className="h-32">
              <LineChart data={leadsOverTime} />
            </div>
          )}
        </div>

        {/* Lead status breakdown */}
        <div className="bg-[#0e0e0e] rounded-2xl border border-white/8 p-5">
          <h2
            className="font-bold text-white text-sm mb-4"
            style={{ fontFamily: "var(--font-syne), sans-serif" }}
          >
            Lead Status
          </h2>
          {leads.length === 0 ? (
            <p className="text-sm text-white/25 text-center py-6">No leads yet.</p>
          ) : (
            <div className="space-y-2.5">
              {[
                { key: "new",       label: "New",       color: "#3b82f6" },
                { key: "contacted", label: "Contacted", color: "#f59e0b" },
                { key: "qualified", label: "Qualified", color: "#8b5cf6" },
                { key: "converted", label: "Converted", color: "#22c55e" },
                { key: "lost",      label: "Lost",      color: "#6b7280" },
              ].map(s => {
                const count = statusCounts[s.key] ?? 0;
                const pct = leads.length ? Math.round((count / leads.length) * 100) : 0;
                return (
                  <div key={s.key} className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: s.color }} />
                    <span className="text-xs text-white/50 flex-1">{s.label}</span>
                    <span className="text-xs font-bold text-white/70">{count}</span>
                    <span className="text-xs text-white/25 w-8 text-right">{pct}%</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

        {/* Conversion funnel */}
        <div className="bg-[#0e0e0e] rounded-2xl border border-white/8 p-5">
          <h2
            className="font-bold text-white text-sm mb-1"
            style={{ fontFamily: "var(--font-syne), sans-serif" }}
          >
            Conversion Funnel
          </h2>
          <p className="text-xs text-white/30 mb-5">From first lead to closed deal</p>
          <Funnel steps={funnelSteps} />
        </div>

        {/* Top options — coming soon */}
        <div className="bg-[#0e0e0e] rounded-2xl border border-white/8 p-5">
          <div className="flex items-start justify-between mb-5">
            <div>
              <h2
                className="font-bold text-white text-sm"
                style={{ fontFamily: "var(--font-syne), sans-serif" }}
              >
                Most Selected Options
              </h2>
              <p className="text-xs text-white/30 mt-0.5">Tracks which options buyers choose most</p>
            </div>
            <span className="text-[10px] bg-white/6 text-white/35 border border-white/10 px-2 py-0.5 rounded-full font-semibold uppercase tracking-wide">Soon</span>
          </div>
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <div className="w-12 h-12 rounded-2xl bg-white/4 border border-white/8 flex items-center justify-center mb-3">
              <svg className="w-5 h-5 text-white/20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
              </svg>
            </div>
            <p className="text-sm text-white/25">Option-level analytics appear once your configurators have visitor traffic.</p>
          </div>
        </div>

      </div>
    </div>
  );
}
