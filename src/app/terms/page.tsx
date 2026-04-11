import type { Metadata } from "next";
import Nav from "@/components/landing/Nav";
import Footer from "@/components/landing/Footer";

export const metadata: Metadata = {
  title: "Terms of Service — ProPlan Studio",
  description: "Terms and conditions governing your use of the ProPlan Studio platform.",
};

const EFFECTIVE_DATE = "April 10, 2026";

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-[#080808] text-white overflow-x-hidden">
      <Nav />

      <section className="pt-32 pb-24 px-5">
        <div className="max-w-2xl mx-auto">
          <p className="text-[11px] font-bold uppercase tracking-widest text-white/25 mb-4">Legal</p>
          <h1 className="text-4xl font-extrabold tracking-tight mb-2" style={{ fontFamily: "var(--font-syne), sans-serif" }}>
            Terms of Service
          </h1>
          <p className="text-sm text-white/30 mb-12">Last updated: {EFFECTIVE_DATE}</p>

          <div className="space-y-8 text-white/55 leading-relaxed text-sm">

            <div>
              <p className="text-white/30 italic mb-6">
                This is a draft. ProPlan Studio LLC recommends having a qualified attorney review these terms before treating them as your final legal document.
              </p>
            </div>

            <section>
              <h2 className="text-lg font-bold text-white mb-3" style={{ fontFamily: "var(--font-syne), sans-serif" }}>1. Acceptance</h2>
              <p>By accessing or using the ProPlan Studio platform (&ldquo;Service&rdquo;), you agree to be bound by these Terms of Service (&ldquo;Terms&rdquo;). If you are using the Service on behalf of a company, you represent that you have the authority to bind that company. If you do not agree to these Terms, do not use the Service.</p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-white mb-3" style={{ fontFamily: "var(--font-syne), sans-serif" }}>2. The Service</h2>
              <p>ProPlan Studio LLC (&ldquo;ProPlan Studio,&rdquo; &ldquo;we,&rdquo; or &ldquo;us&rdquo;) provides a subscription-based visual sales platform for production home builders, including interactive site maps, 3D configurators, AI render generation, in-house studio rendering services, and lead management tools. Features and pricing are defined by your active subscription plan.</p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-white mb-3" style={{ fontFamily: "var(--font-syne), sans-serif" }}>3. Accounts and subscriptions</h2>
              <p className="mb-3">You are responsible for maintaining the confidentiality of your account credentials and for all activity that occurs under your account. Subscriptions are billed in advance on a monthly or annual basis through Stripe. You authorize ProPlan Studio to charge your payment method on each billing cycle.</p>
              <p>You may cancel your subscription at any time from your account settings. Cancellation takes effect at the end of the current billing period. We do not provide refunds for unused portions of a billing period unless required by applicable law.</p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-white mb-3" style={{ fontFamily: "var(--font-syne), sans-serif" }}>4. Acceptable use</h2>
              <p className="mb-3">You agree not to:</p>
              <ul className="list-disc list-inside space-y-2">
                <li>Use the Service for any unlawful purpose or in violation of applicable laws</li>
                <li>Transmit spam, unsolicited messages, or use the outreach features to violate CAN-SPAM, CASL, or similar regulations</li>
                <li>Attempt to gain unauthorized access to any part of the Service or its infrastructure</li>
                <li>Reverse engineer, decompile, or attempt to extract the source code of the Service</li>
                <li>Use the Service to store or transmit malicious code</li>
                <li>Resell, sublicense, or make the Service available to third parties without our prior written consent</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-bold text-white mb-3" style={{ fontFamily: "var(--font-syne), sans-serif" }}>5. Your content</h2>
              <p>You retain ownership of all floor plans, images, brand assets, and other content you upload to the Service (&ldquo;Your Content&rdquo;). By uploading content, you grant ProPlan Studio a limited, non-exclusive license to use Your Content solely to provide the Service to you. We will not use Your Content for marketing purposes without your explicit consent.</p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-white mb-3" style={{ fontFamily: "var(--font-syne), sans-serif" }}>6. Studio renders</h2>
              <p>Studio renders produced by the ProPlan Studio in-house team are delivered to you with full usage rights. You may use, reproduce, and distribute these renders for any commercial or non-commercial purpose without restriction or additional fee. ProPlan Studio retains no rights to use renders produced for your account in its own marketing without your consent.</p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-white mb-3" style={{ fontFamily: "var(--font-syne), sans-serif" }}>7. Availability and uptime</h2>
              <p>We make commercially reasonable efforts to maintain the availability of the Service. Scheduled maintenance will be communicated in advance where practicable. We do not guarantee any specific uptime SLA unless expressly stated in a separate written agreement.</p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-white mb-3" style={{ fontFamily: "var(--font-syne), sans-serif" }}>8. Intellectual property</h2>
              <p>The ProPlan Studio platform, software, design, trademarks, and all related intellectual property are owned by ProPlan Studio LLC. Nothing in these Terms grants you any rights to our intellectual property other than the limited license to use the Service as described herein.</p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-white mb-3" style={{ fontFamily: "var(--font-syne), sans-serif" }}>9. Limitation of liability</h2>
              <p>To the maximum extent permitted by law, ProPlan Studio&apos;s total liability to you for any claim arising out of or related to the Service is limited to the amount you paid us in the 12 months preceding the claim. We are not liable for indirect, incidental, special, consequential, or punitive damages.</p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-white mb-3" style={{ fontFamily: "var(--font-syne), sans-serif" }}>10. Disclaimer of warranties</h2>
              <p>The Service is provided &ldquo;as is&rdquo; and &ldquo;as available&rdquo; without warranties of any kind, express or implied, including but not limited to warranties of merchantability, fitness for a particular purpose, or non-infringement.</p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-white mb-3" style={{ fontFamily: "var(--font-syne), sans-serif" }}>11. Termination</h2>
              <p>Either party may terminate these Terms at any time. ProPlan Studio may suspend or terminate your access immediately if you violate these Terms, engage in fraudulent or abusive behavior, or fail to pay amounts due. Upon termination, your right to use the Service ceases immediately.</p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-white mb-3" style={{ fontFamily: "var(--font-syne), sans-serif" }}>12. Governing law</h2>
              <p>These Terms are governed by the laws of the State of Delaware, USA, without regard to conflict of law principles. Any disputes shall be resolved in the state or federal courts located in Delaware.</p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-white mb-3" style={{ fontFamily: "var(--font-syne), sans-serif" }}>13. Changes to these Terms</h2>
              <p>We may update these Terms from time to time. We will notify you by email at least 14 days before material changes take effect. Continued use of the Service after the effective date constitutes acceptance.</p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-white mb-3" style={{ fontFamily: "var(--font-syne), sans-serif" }}>14. Contact</h2>
              <p>
                Questions about these Terms: <a href="mailto:hello@proplanstudio.com" className="text-blue-400 hover:text-blue-300 underline">hello@proplanstudio.com</a><br />
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
