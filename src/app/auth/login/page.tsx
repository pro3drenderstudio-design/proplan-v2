"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function LoginPage() {
  const router = useRouter();
  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState<string | null>(null);
  const [forgotMode, setForgotMode] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotSent, setForgotSent] = useState(false);
  const [forgotError, setForgotError] = useState<string | null>(null);

  async function handleForgotPassword(e: React.FormEvent) {
    e.preventDefault();
    setForgotLoading(true);
    setForgotError(null);
    const redirectTo = `${window.location.origin}/auth/reset-password`;
    const { error: err } = await supabase.auth.resetPasswordForEmail(forgotEmail, { redirectTo });
    setForgotLoading(false);
    if (err) { setForgotError(err.message); return; }
    setForgotSent(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const { data, error: authErr } = await supabase.auth.signInWithPassword({ email, password });
      if (authErr) {
        setError(authErr.message);
        setLoading(false);
        return;
      }

      // Check profile role to determine where to redirect
      let role = "builder_member";
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: profile } = await (supabase as any)
          .from("profiles")
          .select("role")
          .eq("id", data.user.id)
          .single();
        if (profile?.role) role = profile.role;
      } catch {
        // profiles table missing or no row — default role, redirect to admin if email matches
      }

      const adminRoles = ["super_admin", "manager", "editor", "viewer"];
      // Hard navigation so the new page picks up the Supabase localStorage session
      window.location.href = adminRoles.includes(role) ? "/admin" : "/builder/dashboard";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign in failed. Please try again.");
      setLoading(false);
    }
  }

  const inputClass = "w-full bg-white/5 border border-white/12 rounded-xl px-4 py-3 text-sm text-white placeholder-white/20 outline-none focus:border-blue-500/60 transition-colors";

  return (
    <div className="w-full max-w-sm">
      {/* Logo */}
      <div className="flex flex-col items-center gap-2 mb-8">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo_light.png" alt="ProPlan Studio" className="h-9 object-contain" />
        <p className="text-[9px] text-white/30 uppercase tracking-widest">Sign in to continue</p>
      </div>

      <div className="bg-[#1a1a1a] border border-white/8 rounded-2xl p-6">
        {forgotMode ? (
          <>
            <button onClick={() => { setForgotMode(false); setForgotSent(false); setForgotError(null); }}
              className="flex items-center gap-1.5 text-xs text-white/40 hover:text-white/70 mb-5 transition-colors">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
              Back to sign in
            </button>
            <h1 className="text-lg font-bold text-white mb-1">Reset password</h1>
            <p className="text-xs text-white/40 mb-6">Enter your email and we&apos;ll send a reset link.</p>

            {forgotSent ? (
              <div className="bg-green-500/10 border border-green-500/25 rounded-xl px-4 py-4 text-sm text-green-400 text-center">
                Check your inbox — a reset link is on its way.
              </div>
            ) : (
              <form onSubmit={handleForgotPassword} className="space-y-4">
                {forgotError && (
                  <div className="bg-red-500/10 border border-red-500/25 rounded-xl px-3 py-2.5 text-xs text-red-400">
                    {forgotError}
                  </div>
                )}
                <div>
                  <label className="block text-xs text-white/50 mb-1.5">Email address</label>
                  <input type="email" value={forgotEmail} onChange={e => setForgotEmail(e.target.value)}
                    placeholder="you@example.com" required autoComplete="email"
                    className={inputClass} />
                </div>
                <button type="submit" disabled={forgotLoading}
                  className="w-full py-3 bg-blue-600 text-sm text-white font-semibold rounded-xl hover:bg-blue-500 transition-colors disabled:opacity-50">
                  {forgotLoading ? "Sending..." : "Send Reset Link"}
                </button>
              </form>
            )}
          </>
        ) : (
          <>
            <h1 className="text-lg font-bold text-white mb-1">Welcome back</h1>
            <p className="text-xs text-white/40 mb-6">Sign in to your account to continue.</p>

            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="bg-red-500/10 border border-red-500/25 rounded-xl px-3 py-2.5 text-xs text-red-400">
                  {error}
                </div>
              )}

              <div>
                <label className="block text-xs text-white/50 mb-1.5">Email address</label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                  placeholder="you@proplan.com" required autoComplete="email"
                  className={inputClass} />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs text-white/50">Password</label>
                  <button type="button" onClick={() => { setForgotEmail(email); setForgotMode(true); }}
                    className="text-[10px] text-blue-400 hover:underline">Forgot password?</button>
                </div>
                <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••" required autoComplete="current-password"
                  className={inputClass} />
              </div>

              <button type="submit" disabled={loading}
                className="w-full py-3 bg-blue-600 text-sm text-white font-semibold rounded-xl hover:bg-blue-500 transition-colors disabled:opacity-50 mt-2">
                {loading ? "Signing in..." : "Sign In"}
              </button>
            </form>

            <div className="mt-5 pt-5 border-t border-white/8 text-center">
              <p className="text-xs text-white/30">
                New builder?{" "}
                <Link href="/auth/signup" className="text-blue-400 hover:underline">Create an account</Link>
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
