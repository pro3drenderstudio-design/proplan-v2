"use client";

import { useEffect, useState } from "react";
import BuilderSidebar from "@/components/builder/BuilderSidebar";
import { getImpersonatedBuilder, IMPERSONATE_KEY } from "@/lib/builder-api";
import { supabase } from "@/lib/supabase";

export default function BuilderLayout({ children }: { children: React.ReactNode }) {
  const [impersonating, setImpersonating] = useState<{ id: string; company_name: string } | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { window.location.href = "/auth/login"; return; }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: profile } = await (supabase.from("profiles") as any)
        .select("role")
        .eq("id", user.id)
        .single();
      const role = profile?.role ?? "";
      const isAdminRole = ["super_admin", "manager", "editor", "viewer", "customer_service", "artist"].includes(role);
      const isImpersonating = typeof window !== "undefined" && !!window.localStorage.getItem(IMPERSONATE_KEY);
      if (isAdminRole && !isImpersonating) {
        window.location.href = "/admin";
      }
    });

    getImpersonatedBuilder().then(b => setImpersonating(b));
  }, []);

  function exitImpersonation() {
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(IMPERSONATE_KEY);
    }
    window.location.href = "/admin/builders";
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
            onClick={exitImpersonation}
            className="text-xs bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 px-3 py-1 rounded-lg font-medium transition-colors text-amber-300"
          >
            Exit →
          </button>
        </div>
      )}
      <div className="flex flex-1 overflow-hidden">
        <BuilderSidebar />
        <main className="flex-1 overflow-y-auto bg-[#080808]">
          {children}
        </main>
      </div>
    </div>
  );
}
