"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

function InviteForm() {
  const params = useSearchParams();
  const router = useRouter();
  const token  = params.get("token");

  const [member,   setMember]   = useState<{ id: string; name: string; email: string; role: string; builder_id: string | null } | null>(null);
  const [loading,  setLoading]  = useState(true);
  const [saving,   setSaving]   = useState(false);
  const [error,    setError]    = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [confirm,  setConfirm]  = useState("");
  const [done,     setDone]     = useState(false);

  useEffect(() => {
    if (!token) { setLoading(false); return; }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase.from("team_members") as any)
      .select("id, name, email, role, builder_id, invite_status")
      .eq("invite_token", token)
      .single()
      .then(({ data, error: err }: { data: { id: string; name: string; email: string; role: string; builder_id: string | null; invite_status: string } | null; error: unknown }) => {
        if (err || !data) { setError("This invite link is invalid or has expired."); }
        else if (data.invite_status === "accepted") { setError("This invite has already been accepted."); }
        else { setMember(data); }
        setLoading(false);
      });
  }, [token]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!member || !token) return;
    if (password.length < 8) { setError("Password must be at least 8 characters."); return; }
    if (password !== confirm)  { setError("Passwords do not match."); return; }

    setSaving(true);
    setError(null);

    // Create Supabase auth user
    const { data: authData, error: authErr } = await supabase.auth.signUp({
      email:    member.email,
      password,
      options: { data: { full_name: member.name } },
    });

    if (authErr) { setError(authErr.message); setSaving(false); return; }
    if (!authData.user) { setError("Account creation failed — please try again."); setSaving(false); return; }

    // Create profile
    const isAdmin = !member.builder_id;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from("profiles") as any).insert({
      id:             authData.user.id,
      email:          member.email,
      full_name:      member.name,
      role:           isAdmin ? member.role : "builder_member",
      builder_id:     member.builder_id,
      team_member_id: member.id,
    });

    // Mark invite accepted
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from("team_members") as any)
      .update({ invite_status: "accepted", last_activity: new Date().toISOString() })
      .eq("invite_token", token);

    setSaving(false);
    setDone(true);

    setTimeout(() => {
      router.push(isAdmin ? "/admin" : "/builder/dashboard");
    }, 2000);
  }

  const inputClass = "w-full bg-white/5 border border-white/12 rounded-xl px-4 py-3 text-sm text-white placeholder-white/20 outline-none focus:border-blue-500/60 transition-colors";

  return (
    <div className="w-full max-w-sm">
      <div className="flex flex-col items-center gap-2 mb-8">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo_light.png" alt="ProPlan Studio" className="h-9 object-contain" />
        <p className="text-[9px] text-white/30 uppercase tracking-widest">Team Invitation</p>
      </div>

      <div className="bg-[#1a1a1a] border border-white/8 rounded-2xl p-6">
        {loading ? (
          <div className="flex items-center justify-center py-10">
            <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : done ? (
          <div className="text-center py-6">
            <div className="w-12 h-12 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-3">
              <span className="text-2xl text-green-400">✓</span>
            </div>
            <p className="text-white font-semibold">You&apos;re all set!</p>
            <p className="text-xs text-white/40 mt-1">Redirecting to your dashboard...</p>
          </div>
        ) : !token || error ? (
          <div className="text-center py-6">
            <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center mx-auto mb-3">
              <span className="text-2xl text-red-400">!</span>
            </div>
            <p className="text-white font-semibold">Invalid Invite</p>
            <p className="text-xs text-white/40 mt-1">{error ?? "No invite token found."}</p>
          </div>
        ) : (
          <>
            <div className="mb-5 p-3 bg-blue-600/10 border border-blue-500/20 rounded-xl">
              <p className="text-xs text-blue-300 font-medium">You&apos;ve been invited as</p>
              <p className="text-sm text-white font-bold mt-0.5">{member?.name}</p>
              <p className="text-xs text-white/40">{member?.email} · <span className="capitalize">{member?.role?.replace(/_/g, " ")}</span></p>
            </div>

            <h1 className="text-base font-bold text-white mb-1">Set your password</h1>
            <p className="text-xs text-white/40 mb-5">Choose a secure password to activate your account.</p>

            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="bg-red-500/10 border border-red-500/25 rounded-xl px-3 py-2.5 text-xs text-red-400">{error}</div>
              )}
              <div>
                <label className="block text-xs text-white/50 mb-1.5">New Password</label>
                <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                  placeholder="Min 8 characters" required className={inputClass} />
              </div>
              <div>
                <label className="block text-xs text-white/50 mb-1.5">Confirm Password</label>
                <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)}
                  placeholder="Repeat password" required className={inputClass} />
              </div>
              <button type="submit" disabled={saving}
                className="w-full py-3 bg-blue-600 text-sm text-white font-semibold rounded-xl hover:bg-blue-500 transition-colors disabled:opacity-50 mt-1">
                {saving ? "Activating account..." : "Activate Account"}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}

export default function InvitePage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center h-screen bg-[#0c0c0c]">
        <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <InviteForm />
    </Suspense>
  );
}
