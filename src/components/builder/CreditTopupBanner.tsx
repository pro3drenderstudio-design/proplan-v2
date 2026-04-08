"use client";

import { useState } from "react";

interface Props {
  /** Credits remaining this month */
  remaining: number;
  /** Total credits allocated this month */
  total: number;
  /** How many credits come in the top-up pack */
  packQty: number;
  /** Price of the top-up pack in cents */
  packPrice: number;
  /** Called when user clicks "Buy credits" — receives the Stripe checkout URL */
  builderId: string | null;
  type?: "ai" | "renders";
}

function fmtUSD(cents: number) {
  return (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

export default function CreditTopupBanner({ remaining, total, packQty, packPrice, builderId, type = "ai" }: Props) {
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  const pct       = total > 0 ? Math.max(0, Math.min(100, Math.round((remaining / total) * 100))) : 0;
  const isOut     = remaining <= 0;
  const isLow     = !isOut && pct <= 20;
  const label     = type === "ai" ? "AI render credits" : "render credits";
  const packLabel = type === "ai" ? "AI Credits" : "Render Credits";

  if (!isOut && !isLow) return null; // hide unless low/out

  async function handleBuy() {
    if (!builderId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/stripe/credits", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ builderId, packType: type }),
      });
      const { url, error: apiErr } = await res.json();
      if (apiErr || !url) { setError(apiErr ?? "Failed to start checkout."); setLoading(false); return; }
      window.location.href = url;
    } catch {
      setError("Something went wrong. Please try again.");
      setLoading(false);
    }
  }

  return (
    <div className={`mx-8 mb-0 mt-5 rounded-2xl border px-5 py-4 ${
      isOut
        ? "bg-red-500/8 border-red-500/20"
        : "bg-amber-500/8 border-amber-500/20"
    }`}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className={`w-2 h-2 rounded-full flex-shrink-0 ${isOut ? "bg-red-400" : "bg-amber-400"}`} />
            <p className={`text-sm font-semibold ${isOut ? "text-red-300" : "text-amber-300"}`}>
              {isOut
                ? `You've used all your ${label} this month`
                : `Running low on ${label}`}
            </p>
          </div>
          <p className={`text-xs mb-3 ${isOut ? "text-red-400/60" : "text-amber-400/60"}`}>
            {isOut
              ? `${remaining} of ${total} credits remaining. Buy a top-up to keep generating.`
              : `${remaining} of ${total} credits remaining (${pct}%). Top up before you run out.`}
          </p>

          {/* Credit bar */}
          <div className="h-1.5 bg-white/8 rounded-full overflow-hidden mb-3 max-w-xs">
            <div
              className={`h-full rounded-full transition-all ${isOut ? "bg-red-500" : "bg-amber-400"}`}
              style={{ width: `${pct}%` }}
            />
          </div>

          {error && <p className="text-xs text-red-400 mb-2">{error}</p>}
        </div>

        {packPrice > 0 && (
          <button
            onClick={handleBuy}
            disabled={loading || !builderId}
            className={`flex-shrink-0 px-4 py-2.5 rounded-xl text-sm font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
              isOut
                ? "bg-red-500 hover:bg-red-400 text-white shadow-lg shadow-red-500/20"
                : "bg-amber-500 hover:bg-amber-400 text-black shadow-lg shadow-amber-500/20"
            }`}
          >
            {loading ? "Redirecting…" : `Buy ${packQty} ${packLabel} — ${fmtUSD(packPrice)}`}
          </button>
        )}
      </div>
    </div>
  );
}
