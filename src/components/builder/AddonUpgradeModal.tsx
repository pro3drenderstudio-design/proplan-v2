"use client";

import { useState } from "react";

export interface AddonInfo {
  slug:        string;
  name:        string;
  description: string;
  price:       string;
  included:    string;
}

interface Props {
  addon:    AddonInfo;
  builderId: string;
  onClose: () => void;
}

export default function AddonUpgradeModal({ addon, builderId, onClose }: Props) {
  const [loading, setLoading] = useState(false);
  const [err,     setErr]     = useState("");

  async function handleAdd() {
    setLoading(true);
    setErr("");
    try {
      const res = await fetch("/api/stripe/addon-upgrade", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ builderId, addonSlug: addon.slug }),
      });
      const json = await res.json() as { url?: string; error?: string };
      if (!res.ok) throw new Error(json.error ?? "Failed to create checkout");
      if (json.url) window.location.href = json.url;
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Something went wrong");
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-sm rounded-2xl overflow-hidden"
        style={{ background: "rgba(10,10,16,0.98)", backdropFilter: "blur(32px)", border: "1px solid rgba(255,255,255,0.1)" }}>
        <div className="h-1 bg-gradient-to-r from-blue-600 to-purple-600" />
        <div className="p-6">
          <div className="flex items-start justify-between mb-4">
            <div className="w-10 h-10 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center flex-shrink-0">
              <svg className="w-5 h-5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
              </svg>
            </div>
            <button onClick={onClose} className="text-white/25 hover:text-white/60 text-lg leading-none transition-colors">×</button>
          </div>

          <h2 className="text-base font-bold text-white mb-1">{addon.name}</h2>
          <p className="text-sm text-white/45 leading-relaxed mb-4">{addon.description}</p>

          <div className="rounded-xl px-4 py-3 mb-5 space-y-1.5"
            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
            <div className="flex items-center justify-between">
              <span className="text-xs text-white/40">Monthly price</span>
              <span className="text-sm font-bold text-white">{addon.price}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-white/40">What&apos;s included</span>
              <span className="text-xs text-white/60">{addon.included}</span>
            </div>
          </div>

          {err && <p className="text-xs text-red-400 text-center mb-3">{err}</p>}

          <div className="flex gap-3">
            <button onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-white/10 text-sm text-white/40 hover:text-white transition-colors">
              Cancel
            </button>
            <button onClick={handleAdd} disabled={loading}
              className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-50 transition-all"
              style={{ background: "rgba(37,99,235,0.85)", border: "1px solid rgba(59,130,246,0.4)", boxShadow: "0 4px 20px rgba(37,99,235,0.3)" }}>
              {loading ? "Loading…" : "Add to Plan →"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
