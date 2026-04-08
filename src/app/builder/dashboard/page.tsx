"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getBuilderProjects, getLeads, getBuilderSubscription, Lead } from "@/lib/builder-api";
import { Project, Plan } from "@/types/database";

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmt(n: number) {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 30) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

const STATUS_STYLE: Record<string, string> = {
  live:            "bg-emerald-500/12 text-emerald-400 border border-emerald-500/20",
  in_development:  "bg-blue-500/12 text-blue-400 border border-blue-500/20",
  in_review:       "bg-amber-500/12 text-amber-400 border border-amber-500/20",
  pending_review:  "bg-white/6 text-white/40 border border-white/8",
  archived:        "bg-white/4 text-white/25 border border-white/6",
};

const STATUS_LABEL: Record<string, string> = {
  live:            "Live",
  in_development:  "In Dev",
  in_review:       "In Review",
  pending_review:  "Pending",
  archived:        "Archived",
};

const LEAD_STATUS_STYLE: Record<string, string> = {
  new:       "bg-blue-500/12 text-blue-400 border border-blue-500/20",
  contacted: "bg-amber-500/12 text-amber-400 border border-amber-500/20",
  qualified: "bg-violet-500/12 text-violet-400 border border-violet-500/20",
  converted: "bg-emerald-500/12 text-emerald-400 border border-emerald-500/20",
  lost:      "bg-white/5 text-white/25 border border-white/8",
};

// ── Stat card ─────────────────────────────────────────────────────────────────
function StatCard({
  label, value, sub, accent,
}: { label: string; value: string; sub: string; accent: string }) {
  return (
    <div className="bg-[#0e0e0e] rounded-2xl border border-white/8 p-5 hover:border-white/14 transition-colors">
      <p className="text-[10px] font-semibold text-white/30 uppercase tracking-widest mb-3">{label}</p>
      <p
        className={`text-3xl font-extrabold tracking-tight mb-1 ${accent}`}
        style={{ fontFamily: "var(--font-syne), sans-serif" }}
      >
        {value}
      </p>
      <p className="text-xs text-white/30">{sub}</p>
    </div>
  );
}

// ── Credit bar ────────────────────────────────────────────────────────────────
function CreditBar({ label, used, total, remaining, color }: { label: string; used: number; total: number | null; remaining?: number; color: string }) {
  const unlimited = total === null || total === -1 || total >= 9999;
  const pct = unlimited ? 0 : Math.min(100, Math.round((used / (total ?? 1)) * 100));
  const displayRemaining = remaining ?? ((total ?? 0) - used);
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-xs text-white/50">{label}</span>
        <span className="text-xs font-semibold text-white/70">
          {unlimited ? `${used} used · ∞` : `${displayRemaining} / ${total} remaining`}
        </span>
      </div>
      {!unlimited && (
        <div className="h-1.5 bg-white/8 rounded-full overflow-hidden">
          <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
        </div>
      )}
    </div>
  );
}

// ── Subscription card ─────────────────────────────────────────────────────────
function SubscriptionCard({
  builder, plan,
}: {
  builder: { stripe_subscription_status: string | null; current_period_end: string | null; rendering_credits: number; rendering_credits_total: number; plan_tier: string; ai_credits_remaining: number; ai_credits_total: number };
  plan: Plan | null;
}) {
  const status   = builder.stripe_subscription_status;
  const isActive = status === "active";

  const daysLeft = builder.current_period_end
    ? Math.max(0, Math.ceil((new Date(builder.current_period_end).getTime() - Date.now()) / 86400000))
    : null;

  const rendersUsed      = Math.max(0, (builder.rendering_credits_total ?? 0) - (builder.rendering_credits ?? 0));
  const rendersTotal     = builder.rendering_credits_total;
  const aiRemaining      = builder.ai_credits_remaining ?? 0;
  const aiTotal          = builder.ai_credits_total ?? plan?.ai_credits_monthly ?? null;
  const aiUsed           = Math.max(0, (aiTotal ?? 0) - aiRemaining);

  const statusStyle = isActive
    ? "text-emerald-400 bg-emerald-400/10 border-emerald-400/20"
    : status === "past_due"
      ? "text-red-400 bg-red-400/10 border-red-400/20"
      : "text-amber-400 bg-amber-400/10 border-amber-400/20";

  return (
    <div className="bg-[#0e0e0e] border border-white/8 rounded-2xl p-5 mb-6">
      <div className="flex items-start justify-between mb-4">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-white/25 mb-1">Subscription</p>
          <div className="flex items-center gap-2">
            <p className="text-sm font-bold text-white">ProPlan Studio</p>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border capitalize ${statusStyle}`}>
              {status ?? "inactive"}
            </span>
          </div>
          <p className="text-xs text-white/35 mt-0.5">$1,500 / month</p>
        </div>
        <div className="text-right">
          {daysLeft !== null ? (
            <>
              <p className={`text-2xl font-extrabold ${daysLeft <= 5 ? "text-red-400" : daysLeft <= 10 ? "text-amber-400" : "text-white"}`}
                style={{ fontFamily: "var(--font-syne), sans-serif" }}>
                {daysLeft}d
              </p>
              <p className="text-[10px] text-white/30">until renewal</p>
            </>
          ) : (
            <p className="text-xs text-white/25">—</p>
          )}
        </div>
      </div>

      <div className="space-y-3 pt-3 border-t border-white/8">
        <CreditBar label="Traditional Renders" used={rendersUsed} total={rendersTotal} color="bg-violet-500" />
        <CreditBar label="AI Render Credits"    used={aiUsed}      total={aiTotal}      remaining={aiRemaining} color="bg-amber-400" />
      </div>

      {!isActive && (
        <div className="mt-4 pt-3 border-t border-white/8">
          <Link href="/builder/subscribe"
            className="w-full flex items-center justify-center py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold transition-colors">
            Reactivate subscription →
          </Link>
        </div>
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [leads, setLeads]       = useState<Lead[]>([]);
  const [loading, setLoading]   = useState(true);
  const [subscription, setSubscription] = useState<{ builder: Parameters<typeof SubscriptionCard>[0]["builder"]; plan: Plan | null } | null>(null);

  useEffect(() => {
    Promise.all([getBuilderProjects(), getLeads(), getBuilderSubscription()]).then(([p, l, sub]) => {
      setProjects(p);
      setLeads(l);
      if (sub) setSubscription(sub);
      setLoading(false);
    });
  }, []);

  const liveProjects   = projects.filter(p => (p as any).status === "live");
  const newLeads       = leads.filter(l => l.status === "new").length;
  const totalLeadValue = leads.reduce((s, l) => s + l.total_value, 0);
  const avgValue       = leads.length ? totalLeadValue / leads.length : 0;
  const recentLeads    = leads.slice(0, 6);

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto">

      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <p className="text-xs font-medium text-white/25 uppercase tracking-widest mb-1">
            {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
          </p>
          <h1
            className="text-2xl font-extrabold text-white tracking-tight"
            style={{ fontFamily: "var(--font-syne), sans-serif" }}
          >
            Dashboard
          </h1>
        </div>
        <Link
          href="/builder/projects?new=1"
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold transition-colors shadow-lg shadow-blue-600/20"
        >
          <span className="text-base leading-none">+</span> New Project
        </Link>
      </div>

      {/* Subscription */}
      {subscription && (
        <SubscriptionCard builder={subscription.builder} plan={subscription.plan} />
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <StatCard
          label="Total Projects"
          value={String(projects.length)}
          sub={`${liveProjects.length} live`}
          accent="text-white"
        />
        <StatCard
          label="New Leads"
          value={String(newLeads)}
          sub={`${leads.length} total leads`}
          accent="text-blue-400"
        />
        <StatCard
          label="Configurator Views"
          value="—"
          sub="Analytics coming soon"
          accent="text-white/30"
        />
        <StatCard
          label="Avg Config Value"
          value={avgValue ? fmt(avgValue) : "—"}
          sub={leads.length ? `${leads.length} configurations` : "No leads yet"}
          accent="text-emerald-400"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-5">

        {/* Projects overview */}
        <div className="md:col-span-3 bg-[#0e0e0e] rounded-2xl border border-white/8">
          <div className="flex items-center justify-between px-5 py-4 border-b border-white/6">
            <h2
              className="font-bold text-white text-sm"
              style={{ fontFamily: "var(--font-syne), sans-serif" }}
            >
              My Projects
            </h2>
            <Link href="/builder/projects" className="text-xs text-blue-400 hover:text-blue-300 font-medium transition-colors">
              View all →
            </Link>
          </div>
          <div className="divide-y divide-white/5">
            {loading ? (
              <div className="px-5 py-8 text-center text-sm text-white/25">Loading…</div>
            ) : projects.length === 0 ? (
              <div className="px-5 py-10 text-center">
                <div className="w-12 h-12 rounded-2xl bg-white/4 border border-white/8 flex items-center justify-center mx-auto mb-3">
                  <svg viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth={1.5} className="w-6 h-6">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21" />
                  </svg>
                </div>
                <p className="text-sm text-white/30 mb-3">No projects yet.</p>
                <Link href="/builder/projects?new=1" className="text-sm text-blue-400 hover:text-blue-300 font-medium transition-colors">
                  Request your first project →
                </Link>
              </div>
            ) : (
              projects.slice(0, 5).map(project => {
                const status = (project as any).status ?? "live";
                return (
                  <div key={project.id} className="flex items-center gap-4 px-5 py-3.5 hover:bg-white/3 transition-colors">
                    <div className="w-9 h-9 rounded-xl bg-blue-600/10 border border-blue-500/15 flex items-center justify-center flex-shrink-0">
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
                        stroke="#60a5fa" strokeWidth="1.5" className="w-4.5 h-4.5">
                        <path strokeLinecap="round" strokeLinejoin="round"
                          d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21" />
                      </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-white/80 truncate">{project.name}</p>
                      <p className="text-xs text-white/25">{project.beds}bd · {project.baths}ba · {project.floors ?? 1} fl</p>
                    </div>
                    <span className={`text-xs px-2.5 py-1 rounded-full font-medium flex-shrink-0 ${STATUS_STYLE[status] ?? STATUS_STYLE.live}`}>
                      {STATUS_LABEL[status] ?? "Live"}
                    </span>
                    {project.slug && project.company_slug && (
                      <a
                        href={`/project/${project.company_slug}/${project.slug}`}
                        target="_blank"
                        rel="noreferrer"
                        onClick={e => e.stopPropagation()}
                        className="text-xs text-blue-400 hover:text-blue-300 font-medium flex-shrink-0 transition-colors">
                        Preview →
                      </a>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Recent leads */}
        <div className="md:col-span-2 bg-[#0e0e0e] rounded-2xl border border-white/8">
          <div className="flex items-center justify-between px-5 py-4 border-b border-white/6">
            <h2
              className="font-bold text-white text-sm"
              style={{ fontFamily: "var(--font-syne), sans-serif" }}
            >
              Recent Leads
            </h2>
            <Link href="/builder/leads" className="text-xs text-blue-400 hover:text-blue-300 font-medium transition-colors">
              View all →
            </Link>
          </div>
          <div className="divide-y divide-white/5">
            {loading ? (
              <div className="px-5 py-8 text-center text-sm text-white/25">Loading…</div>
            ) : recentLeads.length === 0 ? (
              <div className="px-5 py-10 text-center">
                <p className="text-sm text-white/30">No leads yet.</p>
                <p className="text-xs text-white/20 mt-1">Leads appear when visitors configure their home.</p>
              </div>
            ) : (
              recentLeads.map(lead => (
                <Link key={lead.id} href="/builder/leads"
                  className="flex items-center gap-3 px-5 py-3 hover:bg-white/3 transition-colors block">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-600/30 to-violet-600/20 border border-white/10 flex items-center justify-center text-xs font-bold text-white/60 flex-shrink-0">
                    {lead.first_name?.[0]}{lead.last_name?.[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-white/70 truncate">
                      {lead.first_name} {lead.last_name}
                    </p>
                    <p className="text-xs text-white/25">{lead.total_value ? fmt(lead.total_value) : "—"} · {timeAgo(lead.created_at)}</p>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${LEAD_STATUS_STYLE[lead.status]}`}>
                    {lead.status.charAt(0).toUpperCase() + lead.status.slice(1)}
                  </span>
                </Link>
              ))
            )}
          </div>
        </div>

      </div>

      {/* Quick actions */}
      <div className="mt-5 grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          {
            label: "Request New Project",
            desc: "Submit a new home model request",
            href: "/builder/projects?new=1",
            accent: "from-blue-600 to-blue-500",
            border: "border-blue-500/20",
            textDesc: "text-blue-200/60",
          },
          {
            label: "View All Leads",
            desc: "Manage and follow up on leads",
            href: "/builder/leads",
            accent: null,
            border: "border-white/8",
            textDesc: "text-white/30",
          },
          {
            label: "Analytics",
            desc: "Track configurator performance",
            href: "/builder/analytics",
            accent: null,
            border: "border-white/8",
            textDesc: "text-white/30",
          },
        ].map(action => (
          <Link key={action.label} href={action.href}
            className={`rounded-2xl p-5 flex flex-col gap-1.5 border ${action.border} transition-all hover:border-white/14 hover:bg-white/3 ${
              action.accent ? `bg-gradient-to-br ${action.accent} shadow-lg shadow-blue-600/15` : "bg-[#0e0e0e]"
            }`}>
            <p
              className={`font-bold text-sm ${action.accent ? "text-white" : "text-white/70"}`}
              style={{ fontFamily: "var(--font-syne), sans-serif" }}
            >
              {action.label}
            </p>
            <p className={`text-xs ${action.textDesc}`}>{action.desc}</p>
          </Link>
        ))}
      </div>

    </div>
  );
}
