import type { Metadata } from "next";
import Nav from "@/components/landing/Nav";
import Footer from "@/components/landing/Footer";

export const metadata: Metadata = {
  title: "Changelog — ProPlan Studio",
  description:
    "New features, improvements, and fixes to the ProPlan Studio platform. Updated regularly.",
};

type ChangeType = "new" | "improved" | "fixed";

interface Change {
  type: ChangeType;
  text: string;
}

interface Release {
  version: string;
  date: string;
  summary: string;
  changes: Change[];
}

const RELEASES: Release[] = [
  {
    version: "v1.5",
    date: "April 2026",
    summary: "Outreach warmup improvements, campaign lead management, and inbox health monitoring.",
    changes: [
      { type: "new",      text: "Inbox auto-flags as error on authentication failures — prevents silent warmup drops." },
      { type: "new",      text: "Campaign leads tab with lot and configuration data attached to each lead." },
      { type: "new",      text: "Timezone setting per campaign for accurate send-time scheduling." },
      { type: "improved", text: "Warmup email send rate now spreads evenly across the day instead of bursting at midnight." },
      { type: "improved", text: "Warmup replies now respect a 30-minute minimum age gate before attempting to respond." },
      { type: "fixed",    text: "New inboxes with no warmup history now start sending immediately on first run." },
    ],
  },
  {
    version: "v1.4",
    date: "March 2026",
    summary: "Gmail OAuth reply polling and multi-community site map support.",
    changes: [
      { type: "new",      text: "Gmail reply polling using Gmail History API — no gmail_history_id required to start." },
      { type: "new",      text: "Multi-community site maps — manage unlimited communities from a single builder dashboard." },
      { type: "new",      text: "Lot detail panel — buyers can see lot dimensions, price premium, and orientation before configuring." },
      { type: "improved", text: "Outreach UI — warmup activity feed, campaign alignment, and CRM reply indicators." },
      { type: "improved", text: "Admin render queue now shows studio request status and 48-hour delivery countdown." },
      { type: "fixed",    text: "Campaign leads tab no longer crashes on projects with FK join edge cases." },
    ],
  },
  {
    version: "v1.3",
    date: "February 2026",
    summary: "AI render studio launch and configurator upgrade with real-time preview.",
    changes: [
      { type: "new",      text: "AI Render Studio — instant photorealistic renders trained on residential home exteriors." },
      { type: "new",      text: "Render saved with lead record — every quote request includes the buyer's AI render preview." },
      { type: "new",      text: "Day and dusk lighting variants for AI renders." },
      { type: "improved", text: "3D Configurator real-time material and elevation preview — no reload required." },
      { type: "improved", text: "Lead record now shows time-on-configurator as an intent signal." },
      { type: "fixed",    text: "Configurator elevation selector no longer resets on mobile when switching floor plans." },
    ],
  },
  {
    version: "v1.2",
    date: "January 2026",
    summary: "Studio render portal, builder onboarding improvements, and plan billing.",
    changes: [
      { type: "new",      text: "Render studio portal — builders submit briefs, upload reference files, and track delivery status." },
      { type: "new",      text: "Stripe subscription billing with monthly and annual options." },
      { type: "new",      text: "Admin plan management — update pricing, credit allocations, and feature flags without a deploy." },
      { type: "improved", text: "Builder onboarding flow reduced from 9 steps to 4." },
      { type: "improved", text: "Builder dashboard analytics — lead volume, configurator sessions, and render credits used." },
      { type: "fixed",    text: "Subscription status now reflects mid-cycle plan changes correctly." },
    ],
  },
  {
    version: "v1.0",
    date: "December 2025",
    summary: "Initial launch — interactive site maps, 3D configurator, and lead capture.",
    changes: [
      { type: "new", text: "Interactive site maps with live lot availability (available, reserved, sold)." },
      { type: "new", text: "3D Configurator — floor plan, elevation, finishes, and options per lot." },
      { type: "new", text: "Buyer lead capture with full configuration data attached." },
      { type: "new", text: "Builder dashboard — lead management, project setup, and community management." },
      { type: "new", text: "Embeddable site map and configurator for any website." },
      { type: "new", text: "Admin dashboard — builder management, plan assignment, and render queue." },
    ],
  },
];

const TYPE_META: Record<ChangeType, { label: string; cls: string }> = {
  new:      { label: "New",      cls: "bg-blue-500/10 text-blue-400 border-blue-500/20" },
  improved: { label: "Improved", cls: "bg-violet-500/10 text-violet-400 border-violet-500/20" },
  fixed:    { label: "Fixed",    cls: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" },
};

export default function ChangelogPage() {
  return (
    <div className="min-h-screen bg-[#080808] text-white overflow-x-hidden">
      <Nav />

      {/* ── HERO ─────────────────────────────────────────────────────────── */}
      <section className="relative pt-32 pb-16 px-5">
        <div className="max-w-2xl mx-auto">
          <p className="text-[11px] font-bold uppercase tracking-widest text-white/25 mb-4">Product updates</p>
          <h1
            className="text-5xl font-extrabold tracking-tight mb-4"
            style={{ fontFamily: "var(--font-syne), sans-serif" }}
          >
            Changelog
          </h1>
          <p className="text-white/40 leading-relaxed">
            New features, improvements, and fixes. We ship regularly — this page reflects what&apos;s live.
          </p>
        </div>
      </section>

      {/* ── RELEASES ─────────────────────────────────────────────────────── */}
      <section className="pb-24 px-5">
        <div className="max-w-2xl mx-auto">
          <div className="relative">
            {/* Timeline line */}
            <div className="absolute left-0 top-2 bottom-2 w-px bg-gradient-to-b from-white/10 to-transparent" />

            <div className="space-y-14 pl-8">
              {RELEASES.map((release) => (
                <div key={release.version} className="relative">
                  {/* Timeline dot */}
                  <div className="absolute -left-[33px] top-1.5 w-2.5 h-2.5 rounded-full bg-white/20 border border-white/10" />

                  <div className="flex items-baseline gap-3 mb-1">
                    <span
                      className="text-lg font-extrabold text-white"
                      style={{ fontFamily: "var(--font-syne), sans-serif" }}
                    >
                      {release.version}
                    </span>
                    <span className="text-xs text-white/30">{release.date}</span>
                  </div>

                  <p className="text-sm text-white/45 mb-5 leading-relaxed">{release.summary}</p>

                  <div className="space-y-2.5">
                    {release.changes.map((change, i) => {
                      const meta = TYPE_META[change.type];
                      return (
                        <div key={i} className="flex items-start gap-3">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-md border text-[10px] font-bold uppercase tracking-wide flex-shrink-0 mt-0.5 ${meta.cls}`}>
                            {meta.label}
                          </span>
                          <p className="text-sm text-white/55 leading-relaxed">{change.text}</p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
