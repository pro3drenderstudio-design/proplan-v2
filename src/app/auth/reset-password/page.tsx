"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword]       = useState("");
  const [confirm,  setConfirm]        = useState("");
  const [loading,  setLoading]        = useState(false);
  const [error,    setError]          = useState<string | null>(null);
  const [ready,    setReady]          = useState(false);
  const [done,     setDone]           = useState(false);

  // Supabase sends the user back with an access_token hash fragment.
  // getSession() picks it up automatically once the page mounts.
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) { setReady(true); return; }
      // Try to exchange the hash fragment (PKCE / implicit flow)
      const { data: listener } = supabase.auth.onAuthStateChange((event) => {
        if (event === "PASSWORD_RECOVERY") setReady(true);
      });
      return () => listener.subscription.unsubscribe();
    });
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) { setError("Passwords do not match."); return; }
    if (password.length < 8)  { setError("Password must be at least 8 characters."); return; }
    setLoading(true);
    setError(null);
    const { error: err } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (err) { setError(err.message); return; }
    setDone(true);
    setTimeout(() => { window.location.href = "/builder/dashboard"; }, 2000);
  }

  const inputClass = "w-full bg-white/5 border border-white/12 rounded-xl px-4 py-3 text-sm text-white placeholder-white/20 outline-none focus:border-blue-500/60 transition-colors";

  return (
    <div className="w-full max-w-sm">
      <div className="flex flex-col items-center gap-2 mb-8">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo_light.png" alt="ProPlan Studio" className="h-9 object-contain" />
        <p className="text-[9px] text-white/30 uppercase tracking-widest">Reset your password</p>
      </div>

      <div className="bg-[#1a1a1a] border border-white/8 rounded-2xl p-6">
        <h1 className="text-lg font-bold text-white mb-1">New password</h1>
        <p className="text-xs text-white/40 mb-6">Choose a new password for your account.</p>

        {done ? (
          <div className="bg-green-500/10 border border-green-500/25 rounded-xl px-4 py-4 text-sm text-green-400 text-center">
            Password updated! Redirecting to your dashboard…
          </div>
        ) : !ready ? (
          <div className="flex justify-center py-6">
            <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="bg-red-500/10 border border-red-500/25 rounded-xl px-3 py-2.5 text-xs text-red-400">
                {error}
              </div>
            )}
            <div>
              <label className="block text-xs text-white/50 mb-1.5">New password</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                placeholder="At least 8 characters" required minLength={8}
                className={inputClass} />
            </div>
            <div>
              <label className="block text-xs text-white/50 mb-1.5">Confirm password</label>
              <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)}
                placeholder="••••••••" required
                className={inputClass} />
            </div>
            <button type="submit" disabled={loading}
              className="w-full py-3 bg-blue-600 text-sm text-white font-semibold rounded-xl hover:bg-blue-500 transition-colors disabled:opacity-50 mt-2">
              {loading ? "Saving…" : "Set New Password"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
