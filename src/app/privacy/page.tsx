import type { Metadata } from "next";
import Nav from "@/components/landing/Nav";
import Footer from "@/components/landing/Footer";

export const metadata: Metadata = {
  title: "Privacy Policy — ProPlan Studio",
  description: "How ProPlan Studio collects, uses, and protects your personal information.",
};

const EFFECTIVE_DATE = "April 10, 2026";

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-[#080808] text-white overflow-x-hidden">
      <Nav />

      <section className="pt-32 pb-24 px-5">
        <div className="max-w-2xl mx-auto">
          <p className="text-[11px] font-bold uppercase tracking-widest text-white/25 mb-4">Legal</p>
          <h1 className="text-4xl font-extrabold tracking-tight mb-2" style={{ fontFamily: "var(--font-syne), sans-serif" }}>
            Privacy Policy
          </h1>
          <p className="text-sm text-white/30 mb-12">Last updated: {EFFECTIVE_DATE}</p>

          <div className="prose prose-invert prose-sm max-w-none space-y-8 text-white/55 leading-relaxed">

            <div>
              <p className="text-white/30 text-sm italic mb-6">
                This policy is a draft. ProPlan Studio LLC recommends having a qualified attorney review it before relying on it as your final legal document.
              </p>
            </div>

            <section>
              <h2 className="text-lg font-bold text-white mb-3" style={{ fontFamily: "var(--font-syne), sans-serif" }}>1. Who we are</h2>
              <p>ProPlan Studio LLC (&ldquo;ProPlan Studio,&rdquo; &ldquo;we,&rdquo; &ldquo;us,&rdquo; or &ldquo;our&rdquo;) is a limited liability company incorporated in Delaware, USA. We operate proplanstudio.com and the ProPlan Studio platform (the &ldquo;Service&rdquo;). You can reach us at hello@proplanstudio.com.</p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-white mb-3" style={{ fontFamily: "var(--font-syne), sans-serif" }}>2. Information we collect</h2>
              <p className="mb-3"><strong className="text-white/75">Account information.</strong> When you create an account or subscribe, we collect your name, email address, company name, and billing information (processed by Stripe — we do not store raw card numbers).</p>
              <p className="mb-3"><strong className="text-white/75">Usage data.</strong> We collect information about how you use the Service — pages visited, features accessed, configurator sessions, render requests, and lead activity — to operate and improve the platform.</p>
              <p className="mb-3"><strong className="text-white/75">Buyer data you provide.</strong> When home buyers interact with your embedded site map or configurator, data they submit (name, email, phone, configuration selections) is stored on your behalf as your leads. You are the data controller for this information.</p>
              <p className="mb-3"><strong className="text-white/75">Email integration data.</strong> If you connect Gmail or Outlook inboxes for the outreach features, we store OAuth refresh tokens and email metadata (subject lines, send timestamps, thread IDs). We do not read the full content of emails beyond what is necessary to operate the warmup and outreach features.</p>
              <p><strong className="text-white/75">Cookies and analytics.</strong> We use cookies for authentication sessions and basic analytics. See our <a href="/cookies" className="text-blue-400 hover:text-blue-300 underline">Cookie Policy</a> for details.</p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-white mb-3" style={{ fontFamily: "var(--font-syne), sans-serif" }}>3. How we use your information</h2>
              <ul className="list-disc list-inside space-y-2">
                <li>To provide, operate, and improve the Service</li>
                <li>To process payments and manage subscriptions</li>
                <li>To send transactional emails (account confirmations, invoices, render delivery notifications)</li>
                <li>To respond to support requests</li>
                <li>To detect and prevent fraud, abuse, or security incidents</li>
                <li>To comply with legal obligations</li>
              </ul>
              <p className="mt-3">We do not sell your personal information or your buyers&apos; data to third parties. We do not use your data for advertising purposes.</p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-white mb-3" style={{ fontFamily: "var(--font-syne), sans-serif" }}>4. Data sharing</h2>
              <p className="mb-3">We share data only with service providers necessary to operate the platform:</p>
              <ul className="list-disc list-inside space-y-2 mb-3">
                <li><strong className="text-white/75">Supabase</strong> — database and file storage (hosted on AWS)</li>
                <li><strong className="text-white/75">Vercel</strong> — hosting and serverless functions</li>
                <li><strong className="text-white/75">Stripe</strong> — payment processing</li>
                <li><strong className="text-white/75">FAL.ai</strong> — AI image generation for render previews</li>
                <li><strong className="text-white/75">Google / Microsoft</strong> — OAuth authentication for connected inboxes</li>
              </ul>
              <p>All service providers are contractually obligated to process data only as necessary for the services they provide.</p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-white mb-3" style={{ fontFamily: "var(--font-syne), sans-serif" }}>5. Data retention</h2>
              <p>We retain your account data for as long as your subscription is active and for up to 90 days after cancellation, after which it is deleted. You may request deletion at any time by emailing hello@proplanstudio.com. Lead data you have collected on behalf of buyers is subject to your own retention decisions as the data controller.</p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-white mb-3" style={{ fontFamily: "var(--font-syne), sans-serif" }}>6. Security</h2>
              <p>We use encryption in transit (TLS 1.2+) and at rest. Access to production systems is restricted to authorized personnel with multi-factor authentication. See our <a href="/security" className="text-blue-400 hover:text-blue-300 underline">Security page</a> for more detail.</p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-white mb-3" style={{ fontFamily: "var(--font-syne), sans-serif" }}>7. Your rights</h2>
              <p className="mb-3">Depending on your location, you may have the right to access, correct, delete, or export your personal data. To exercise any of these rights, email hello@proplanstudio.com. We will respond within 30 days.</p>
              <p><strong className="text-white/75">California residents (CCPA).</strong> You have the right to know what personal information we collect, request deletion, and opt out of the sale of your personal information. We do not sell personal information.</p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-white mb-3" style={{ fontFamily: "var(--font-syne), sans-serif" }}>8. Children&apos;s privacy</h2>
              <p>The Service is not directed to individuals under the age of 16. We do not knowingly collect personal information from children.</p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-white mb-3" style={{ fontFamily: "var(--font-syne), sans-serif" }}>9. Changes to this policy</h2>
              <p>We may update this Privacy Policy from time to time. When we do, we will update the &ldquo;Last updated&rdquo; date at the top and notify active subscribers by email for material changes.</p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-white mb-3" style={{ fontFamily: "var(--font-syne), sans-serif" }}>10. Contact</h2>
              <p>Questions about this policy: <a href="mailto:hello@proplanstudio.com" className="text-blue-400 hover:text-blue-300 underline">hello@proplanstudio.com</a><br />ProPlan Studio LLC · Delaware, USA</p>
            </section>

          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
