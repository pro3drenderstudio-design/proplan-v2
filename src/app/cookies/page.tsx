import type { Metadata } from "next";
import Nav from "@/components/landing/Nav";
import Footer from "@/components/landing/Footer";

export const metadata: Metadata = {
  title: "Cookie Policy — ProPlan Studio",
  description: "How ProPlan Studio uses cookies and similar technologies on its platform and website.",
};

const EFFECTIVE_DATE = "April 10, 2026";

const COOKIE_TABLE = [
  {
    name: "sb-access-token / sb-refresh-token",
    purpose: "Authentication session",
    type: "Strictly necessary",
    duration: "Session / 1 year",
  },
  {
    name: "proplan-billing-preference",
    purpose: "Remembers your monthly/annual billing toggle on the pricing page",
    type: "Functional",
    duration: "30 days",
  },
  {
    name: "_vercel_no_cache",
    purpose: "Vercel deployment infrastructure",
    type: "Strictly necessary",
    duration: "Session",
  },
];

export default function CookiesPage() {
  return (
    <div className="min-h-screen bg-[#080808] text-white overflow-x-hidden">
      <Nav />

      <section className="pt-32 pb-24 px-5">
        <div className="max-w-2xl mx-auto">
          <p className="text-[11px] font-bold uppercase tracking-widest text-white/25 mb-4">Legal</p>
          <h1 className="text-4xl font-extrabold tracking-tight mb-2" style={{ fontFamily: "var(--font-syne), sans-serif" }}>
            Cookie Policy
          </h1>
          <p className="text-sm text-white/30 mb-12">Last updated: {EFFECTIVE_DATE}</p>

          <div className="space-y-8 text-white/55 leading-relaxed text-sm">

            <section>
              <h2 className="text-lg font-bold text-white mb-3" style={{ fontFamily: "var(--font-syne), sans-serif" }}>What are cookies?</h2>
              <p>Cookies are small text files placed on your device when you visit a website. They allow the website to remember information about your visit — like whether you are logged in — so you don&apos;t have to re-enter it every time.</p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-white mb-3" style={{ fontFamily: "var(--font-syne), sans-serif" }}>How we use cookies</h2>
              <p className="mb-4">ProPlan Studio uses a minimal set of cookies. We do not use third-party advertising cookies, behavioral tracking cookies, or social media tracking pixels.</p>

              <div className="bg-[#0e0e0e] border border-white/8 rounded-2xl overflow-hidden">
                <div className="border-b border-white/6 px-5 py-3">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-white/25">Cookies we set</p>
                </div>
                <div className="divide-y divide-white/5">
                  <div className="grid grid-cols-4 gap-3 px-5 py-2 text-[10px] font-bold uppercase tracking-wider text-white/20">
                    <span>Name</span>
                    <span className="col-span-2">Purpose</span>
                    <span>Duration</span>
                  </div>
                  {COOKIE_TABLE.map((row) => (
                    <div key={row.name} className="grid grid-cols-4 gap-3 px-5 py-3.5 items-start">
                      <p className="text-xs text-white/55 font-mono break-all">{row.name}</p>
                      <div className="col-span-2">
                        <p className="text-xs text-white/55 mb-1">{row.purpose}</p>
                        <span className="inline-block text-[10px] font-semibold px-2 py-0.5 rounded bg-white/6 text-white/35">{row.type}</span>
                      </div>
                      <p className="text-xs text-white/40">{row.duration}</p>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            <section>
              <h2 className="text-lg font-bold text-white mb-3" style={{ fontFamily: "var(--font-syne), sans-serif" }}>Strictly necessary cookies</h2>
              <p>Authentication cookies are required for the Service to function. Without them you cannot log in or remain authenticated. These cookies cannot be disabled.</p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-white mb-3" style={{ fontFamily: "var(--font-syne), sans-serif" }}>Third-party cookies</h2>
              <p className="mb-3">We embed a Calendly scheduling widget on our demo booking page. Calendly may set its own cookies when you interact with the scheduling widget. We do not control those cookies — please review Calendly&apos;s privacy policy for details.</p>
              <p>We do not use Google Analytics, Facebook Pixel, or any other advertising or behavioral tracking third party on proplanstudio.com.</p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-white mb-3" style={{ fontFamily: "var(--font-syne), sans-serif" }}>Managing cookies</h2>
              <p className="mb-3">You can control and delete cookies through your browser settings. Note that disabling strictly necessary cookies will prevent you from logging in to ProPlan Studio.</p>
              <p>Most browsers allow you to:</p>
              <ul className="list-disc list-inside space-y-1.5 mt-2">
                <li>View all cookies stored on your device</li>
                <li>Delete all cookies or cookies from a specific site</li>
                <li>Block cookies from specific sites</li>
                <li>Block all third-party cookies</li>
              </ul>
              <p className="mt-3">Refer to your browser&apos;s help documentation for instructions specific to your browser and version.</p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-white mb-3" style={{ fontFamily: "var(--font-syne), sans-serif" }}>Changes to this policy</h2>
              <p>We may update this Cookie Policy when we change the cookies we use. Changes will be reflected by an updated &ldquo;Last updated&rdquo; date above.</p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-white mb-3" style={{ fontFamily: "var(--font-syne), sans-serif" }}>Contact</h2>
              <p>
                Questions about cookies:{" "}
                <a href="mailto:hello@proplanstudio.com" className="text-blue-400 hover:text-blue-300 underline">hello@proplanstudio.com</a><br />
                ProPlan Studio LLC · Delaware, USA
              </p>
            </section>

          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
