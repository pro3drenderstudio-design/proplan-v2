"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import BuilderSidebar from "@/components/builder/BuilderSidebar";
import { getImpersonatedBuilder, IMPERSONATE_KEY } from "@/lib/builder-api";
import { supabase } from "@/lib/supabase";

export default function BuilderLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [impersonating, setImpersonating] = useState<{ id: string; company_name: string } | null>(null);
  const [authStatus, setAuthStatus] = useState<"loading" | "ok" | "unsubscribed">("loading");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const isSubscribePage = pathname?.startsWith("/builder/subscribe") ?? false;

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { window.location.href = "/auth/login"; return; }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: profile } = await (supabase.from("profiles") as any)
        .select("role, builder_id")
        .eq("id", user.id)
        .single();

      const role = profile?.role ?? "";
      const isAdminRole = ["super_admin", "manager", "editor", "viewer", "customer_service", "artist"].includes(role);
      const isImpersonating = typeof window !== "undefined" && !!window.localStorage.getItem(IMPERSONATE_KEY);

      if (isAdminRole && !isImpersonating) {
        window.location.href = "/admin";
        return;
      }

      if (!isImpersonating && profile?.builder_id) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: builder } = await (supabase.from("builders") as any)
          .select("stripe_subscription_status")
          .eq("id", profile.builder_id)
          .single();
        const active = builder?.stripe_subscription_status === "active";
        if (!active) {
          setAuthStatus("unsubscribed");
          return;
        }
      }

      setAuthStatus("ok");
    });

    getImpersonatedBuilder().then(b => setImpersonating(b));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // If not on subscribe page and unsubscribed (even after client-side nav), redirect
  if (!isSubscribePage && authStatus === "unsubscribed") {
    if (typeof window !== "undefined") window.location.href = "/builder/subscribe";
    return null;
  }

  // Loading state — show spinner while auth check runs (prevents flash of content)
  if (authStatus === "loading" && !isSubscribePage) {
    return (
      <div className="min-h-screen bg-[#080808] flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Subscribe page gets no sidebar
  if (isSubscribePage) {
    return <div className="min-h-screen bg-[#080808]">{children}</div>;
  }

  return (
    <div className="flex flex-col h-screen bg-[#080808] overflow-hidden">
      {/* Impersonation banner */}
      {impersonating && (
        <div className="flex-shrink-0 bg-amber-500/10 border-b border-amber-500/25 text-amber-400 px-5 py-2.5 flex items-center justify-between z-50">
          <div className="flex items-center gap-2.5 text-sm font-medium">
            <div className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
            Viewing as <strong className="text-amber-300 ml-0.5">{impersonating.company_name}</strong>
            <span className="text-amber-500/60">— Support / Admin View</span>
          </div>
          <button
            onClick={() => {
              if (typeof window !== "undefined") window.localStorage.removeItem(IMPERSONATE_KEY);
              window.location.href = "/admin/builders";
            }}
            className="text-xs bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 px-3 py-1 rounded-lg font-medium transition-colors text-amber-300"
          >
            Exit →
          </button>
        </div>
      )}
      <div className="flex flex-1 overflow-hidden">
        {/* Mobile top bar */}
        <div className="md:hidden fixed top-0 inset-x-0 z-30 bg-[#080808] border-b border-white/6 flex items-center justify-between px-4 h-14">
          <button
            onClick={() => setSidebarOpen(true)}
            className="flex items-center justify-center w-9 h-9 rounded-lg hover:bg-white/8 transition-colors text-white/60 hover:text-white"
            aria-label="Open menu"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo_light.png" alt="ProPlan Studio" className="h-6 object-contain" />
          <div className="w-9" />
        </div>
        <BuilderSidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <main className="flex-1 overflow-y-auto bg-[#080808] pt-14 md:pt-0">
          {children}
        </main>
      </div>
    </div>
  );
}
