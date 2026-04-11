import type { Metadata } from "next";
import Nav from "@/components/landing/Nav";
import Footer from "@/components/landing/Footer";

export const metadata: Metadata = {
  title: "Security — ProPlan Studio",
  description:
    "How ProPlan Studio protects your data, your buyers' data, and your connected accounts. Infrastructure, encryption, access controls, and incident response.",
  openGraph: {
    title: "Security at ProPlan Studio",
    description:
      "We build on enterprise-grade infrastructure and follow security best practices to protect your data and your buyers.",
  },
};

function Check() {
  return (
    <svg className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-px" viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="8" r="7" fill="#10b981" fillOpacity="0.12" />
      <path d="M5 8.5l2 2 4-4" stroke="#34d399" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const SECTIONS = [
  {
    icon: (
      <svg className="w-5 h-5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15a4.5 4.5 0 004.5 4.5H18a3.75 3.75 0 001.332-7.257 3 3 0 00-3.758-3.848 5.25 5.25 0 00-10.233 2.33A4.502 4.502 0 002.25 15z" />
      </svg>
    ),
    title: "Infrastructure",
    color: "blue",
    points: [
      "Hosted on Vercel — enterprise-grade serverless infrastructure with global edge network",
      "Database and file storage on Supabase (PostgreSQL on AWS) with automated daily backups",
      "All services operate in SOC 2 Type II certified data centers",
      "Zero-downtime deployments — no maintenance windows that affect your buyers",
    ],
  },
  {
    icon: (
      <svg className="w-5 h-5 text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
      </svg>
    ),
    title: "Encryption",
    color: "violet",
    points: [
      "All data in transit is encrypted with TLS 1.2 or higher — enforced on every request",
      "All data at rest is encrypted using AES-256 at the storage level",
      "Payment card data is never stored by us — Stripe handles all card data under PCI DSS",
      "OAuth refresh tokens for connected inboxes are stored encrypted and are never exposed via API",
    ],
  },
  {
    icon: (
      <svg className="w-5 h-5 text-teal-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
      </svg>
    ),
    title: "Access controls",
    color: "teal",
    points: [
      "Row-Level Security (RLS) on every database table — users can only access data scoped to their account",
      "Service-role database access is restricted to server-side API routes only; the client never touches it",
      "Admin accounts are protected with multi-factor authentication",
      "All production access is logged and reviewed",
    ],
  },
  {
    icon: (
      <svg className="w-5 h-5 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
      </svg>
    ),
    title: "Email integration security",
    color: "amber",
    points: [
      "Gmail and Outlook connections use OAuth 2.0 — we never see or store your email password",
      "OAuth tokens are scoped to the minimum permissions required (send, read metadata)",
      "Tokens can be revoked at any time from your Google or Microsoft account settings",
      "Connected inboxes that fail authentication are flagged automatically and stop sending",
    ],
  },
  {
    icon: (
      <svg className="w-5 h-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
      </svg>
    ),
    title: "Incident response",
    color: "emerald",
    points: [
      "Security incidents are assessed within 24 hours of detection",
      "Affected customers are notified within 72 hours of a confirmed data breach",
      "Post-incident reports are available on request for significant incidents",
      "To report a vulnerability, email hello@proplanstudio.com with subject line: Security",
    ],
  },
  {
    icon: (
      <svg className="w-5 h-5 text-white/40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418" />
      </svg>
    ),
    title: "Data residency and compliance",
    color: "white",
    points: [
      "All data is stored in the United States on AWS infrastructure",
      "We comply with applicable US data protection laws including CCPA",
      "GDPR: ProPlan Studio acts as a data processor for buyer lead data; you are the controller",
      "Data Processing Agreements (DPA) are available on request for enterprise customers",
    ],
  },
];

export default function SecurityPage() {
  return (
    <div className="min-h-screen bg-[#080808] text-white overflow-x-hidden">
      <Nav />

      {/* ── HERO ─────────────────────────────────────────────────────────── */}
      <section className="relative pt-32 pb-16 px-5 overflow-hidden">
        <div className="absolute inset-0 blueprint-grid opacity-20" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_50%_at_50%_0%,rgba(8,8,8,0)_0%,#080808_80%)]" />
        <div className="relative max-w-2xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-emerald-500/20 bg-emerald-500/8 text-[11px] font-semibold text-emerald-400 uppercase tracking-wide mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" /> Infrastructure & data protection
          </div>
          <h1
            className="text-5xl font-extrabold tracking-tight mb-5"
            style={{ fontFamily: "var(--font-syne), sans-serif" }}
          >
            Security at ProPlan Studio
          </h1>
          <p className="text-white/45 leading-relaxed">
            Your data — and your buyers&apos; data — is protected by enterprise-grade infrastructure, end-to-end encryption, and strict access controls. Here&apos;s exactly how.
          </p>
        </div>
      </section>

      {/* ── TRUST STATS ──────────────────────────────────────────────────── */}
      <section className="py-10 px-5">
        <div className="max-w-3xl mx-auto grid grid-cols-3 gap-4 text-center">
          {[
            { value: "TLS 1.2+",  label: "All traffic encrypted" },
            { value: "AES-256",   label: "Encryption at rest" },
            { value: "OAuth 2.0", label: "Email integration auth" },
          ].map((s) => (
            <div key={s.label} className="bg-[#0e0e0e] border border-white/8 rounded-2xl p-5">
              <p className="text-lg font-bold text-white mb-1" style={{ fontFamily: "var(--font-syne), sans-serif" }}>{s.value}</p>
              <p className="text-[10px] text-white/30">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── SECTIONS ─────────────────────────────────────────────────────── */}
      <section className="py-12 px-5">
        <div className="max-w-3xl mx-auto space-y-5">
          {SECTIONS.map((sec) => {
            const borderCls =
              sec.color === "blue"    ? "border-blue-500/15"   :
              sec.color === "violet"  ? "border-violet-500/15" :
              sec.color === "teal"    ? "border-teal-500/15"   :
              sec.color === "amber"   ? "border-amber-500/15"  :
              sec.color === "emerald" ? "border-emerald-500/15":
              "border-white/8";
            return (
              <div key={sec.title} className={`bg-[#0e0e0e] border ${borderCls} rounded-2xl p-7`}>
                <div className="flex items-center gap-3 mb-5">
                  <div className="w-9 h-9 rounded-xl bg-white/5 border border-white/8 flex items-center justify-center flex-shrink-0">
                    {sec.icon}
                  </div>
                  <h2 className="text-base font-bold text-white" style={{ fontFamily: "var(--font-syne), sans-serif" }}>{sec.title}</h2>
                </div>
                <ul className="space-y-2.5">
                  {sec.points.map((p) => (
                    <li key={p} className="flex items-start gap-2.5 text-sm text-white/50">
                      <Check /> {p}
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </section>

      {/* ── REPORT A VULNERABILITY ───────────────────────────────────────── */}
      <section className="py-16 px-5 border-t border-white/6">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-2xl font-extrabold tracking-tight mb-3" style={{ fontFamily: "var(--font-syne), sans-serif" }}>
            Found a security issue?
          </h2>
          <p className="text-white/40 mb-6 leading-relaxed">
            We take all security reports seriously. Email us at{" "}
            <a href="mailto:hello@proplanstudio.com?subject=Security" className="text-blue-400 hover:text-blue-300 underline transition-colors">
              hello@proplanstudio.com
            </a>{" "}
            with the subject line &ldquo;Security&rdquo;. We will acknowledge within 24 hours and work to resolve confirmed vulnerabilities promptly.
          </p>
          <p className="text-xs text-white/22">We do not currently operate a formal bug bounty program, but we are grateful for responsible disclosures.</p>
        </div>
      </section>

      <Footer />
    </div>
  );
}
