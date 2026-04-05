"use client";

import { useEffect, useState, useRef, Suspense } from "react";
import { supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

// ── Types ─────────────────────────────────────────────────────────────────────

interface TeamMemberRow {
  id:            string;
  name:          string;
  email:         string;
  role:          "builder_admin" | "builder_member";
  invite_status: "pending" | "accepted";
  last_activity: string;
  invite_sent_at: string | null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function timeAgo(s: string) {
  const diff = Date.now() - new Date(s).getTime();
  const days = Math.floor(diff / 86400000);
  const hrs  = Math.floor(diff / 3600000);
  if (hrs < 1)  return "Just now";
  if (hrs < 24) return `${hrs}h ago`;
  if (days < 30) return `${days}d ago`;
  return new Date(s).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function initials(name: string) {
  return name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
}

const AVATAR_COLORS = [
  "from-blue-600 to-blue-800",
  "from-violet-600 to-violet-800",
  "from-emerald-600 to-emerald-800",
  "from-amber-600 to-amber-800",
  "from-pink-600 to-pink-800",
];

const INPUT  = "w-full bg-[#141414] border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white/80 placeholder-white/20 focus:outline-none focus:ring-1 focus:ring-blue-500/60 focus:border-blue-500/40 transition-colors";

// ── Main content ──────────────────────────────────────────────────────────────

function TeamContent() {
  const [members,      setMembers]      = useState<TeamMemberRow[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [builderId,    setBuilderId]    = useState<string | null>(null);
  const [seats,        setSeats]        = useState({ used: 0, included: 1 });
  const [showInvite,   setShowInvite]   = useState(false);
  const [removingId,   setRemovingId]   = useState<string | null>(null);
  const [resendingId,  setResendingId]  = useState<string | null>(null);
  const [error,        setError]        = useState<string | null>(null);

  // Invite form
  const [inviteName,   setInviteName]   = useState("");
  const [inviteEmail,  setInviteEmail]  = useState("");
  const [inviteRole,   setInviteRole]   = useState<"builder_admin" | "builder_member">("builder_member");
  const [submitting,   setSubmitting]   = useState(false);
  const [inviteError,  setInviteError]  = useState<string | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: profile } = await (supabase.from("profiles") as any)
        .select("builder_id").eq("id", user.id).single();
      if (!profile?.builder_id) { setLoading(false); return; }
      setBuilderId(profile.builder_id);

      // Load builder seat counts
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: builder } = await (supabase.from("builders") as any)
        .select("seats_used, seats_included").eq("id", profile.builder_id).single();
      if (builder) setSeats({ used: builder.seats_used, included: builder.seats_included });

      // Load team members for this builder
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: members } = await (supabase.from("team_members") as any)
        .select("id, name, email, role, invite_status, last_activity, invite_sent_at")
        .eq("builder_id", profile.builder_id)
        .order("invite_sent_at", { ascending: false });

      setMembers(members ?? []);
      setLoading(false);
    }
    load();
  }, []);

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    if (!builderId) return;
    setSubmitting(true);
    setInviteError(null);
    try {
      const res = await fetch("/api/builder/team", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ builderId, name: inviteName, email: inviteEmail, role: inviteRole }),
      });
      const json = await res.json();
      if (!res.ok) { setInviteError(json.error ?? "Failed to send invite."); setSubmitting(false); return; }

      // Add to local list
      setMembers(prev => [{
        id:            json.memberId,
        name:          inviteName,
        email:         inviteEmail,
        role:          inviteRole,
        invite_status: "pending",
        last_activity: new Date().toISOString(),
        invite_sent_at: new Date().toISOString(),
      }, ...prev]);
      setSeats(s => ({ ...s, used: s.used + 1 }));
      setInviteName("");
      setInviteEmail("");
      setInviteRole("builder_member");
      setShowInvite(false);
    } catch {
      setInviteError("Something went wrong. Please try again.");
    }
    setSubmitting(false);
  }

  async function handleRemove(memberId: string) {
    if (!builderId || !confirm("Remove this team member?")) return;
    setRemovingId(memberId);
    const res = await fetch("/api/builder/team", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ memberId, builderId }),
    });
    if (res.ok) {
      setMembers(prev => prev.filter(m => m.id !== memberId));
      setSeats(s => ({ ...s, used: Math.max(0, s.used - 1) }));
    } else {
      setError("Failed to remove member.");
    }
    setRemovingId(null);
  }

  async function handleResend(memberId: string) {
    setResendingId(memberId);
    await fetch("/api/auth/invite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ memberId }),
    });
    setResendingId(null);
  }

  const seatPct     = seats.included > 0 ? (seats.used / seats.included) * 100 : 0;
  const seatsLeft   = seats.included - seats.used;
  const atLimit     = seatsLeft <= 0;

  return (
    <div className="p-8 max-w-4xl mx-auto text-white">

      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Team</h1>
          <p className="text-sm text-white/30 mt-0.5">Invite and manage your team members.</p>
        </div>
        <button
          onClick={() => { if (atLimit) { setError("Seat limit reached. Upgrade your plan to add more members."); return; } setShowInvite(true); setError(null); }}
          className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-sm font-bold transition-colors shadow-lg shadow-blue-600/20 flex items-center gap-2"
        >
          <span className="text-base leading-none">+</span>
          Invite Member
        </button>
      </div>

      {/* Seat meter */}
      <div className="bg-[#0e0e0e] border border-white/8 rounded-2xl px-6 py-4 flex items-center gap-6 mb-6">
        <div className="flex-1">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-white/40 uppercase tracking-wide">Team Seats</span>
            <span className={`text-xs font-bold ${atLimit ? "text-orange-400" : "text-white/50"}`}>
              {seatsLeft} remaining
            </span>
          </div>
          <div className="h-1.5 bg-white/6 rounded-full overflow-hidden">
            <div className={`h-full rounded-full transition-all ${atLimit ? "bg-orange-500" : "bg-blue-500"}`}
              style={{ width: `${Math.min(seatPct, 100)}%` }} />
          </div>
          <p className="text-[11px] text-white/25 mt-1.5">{seats.used} of {seats.included} seats used</p>
        </div>
        <div className="text-right flex-shrink-0">
          <p className="text-2xl font-extrabold text-white">{seatsLeft}</p>
          <p className="text-[10px] text-white/25">seats left</p>
        </div>
      </div>

      {error && (
        <div className="mb-4 px-4 py-3 bg-red-500/8 border border-red-500/20 rounded-xl text-sm text-red-400 flex items-center justify-between">
          {error}
          <button onClick={() => setError(null)} className="text-red-400/50 hover:text-red-400 ml-3">×</button>
        </div>
      )}

      {/* Members list */}
      {loading ? (
        <div className="space-y-3">
          {[1,2].map(i => <div key={i} className="h-20 bg-[#0e0e0e] rounded-2xl animate-pulse" />)}
        </div>
      ) : members.length === 0 ? (
        <div className="bg-[#0e0e0e] border border-white/8 rounded-2xl py-20 text-center">
          <div className="w-12 h-12 mx-auto mb-4 rounded-2xl bg-blue-500/10 border border-blue-500/15 flex items-center justify-center">
            <svg className="w-6 h-6 text-blue-400/60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
            </svg>
          </div>
          <p className="text-white/30 text-sm mb-1">No team members yet.</p>
          <button onClick={() => setShowInvite(true)} className="text-blue-400 text-sm font-semibold hover:text-blue-300 transition-colors">
            + Invite your first member
          </button>
        </div>
      ) : (
        <div className="bg-[#0e0e0e] border border-white/8 rounded-2xl divide-y divide-white/6 overflow-hidden">
          {members.map((m, i) => (
            <div key={m.id} className="flex items-center gap-4 px-5 py-4">
              {/* Avatar */}
              <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${AVATAR_COLORS[i % AVATAR_COLORS.length]} flex items-center justify-center flex-shrink-0`}>
                <span className="text-xs font-bold text-white">{initials(m.name)}</span>
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-semibold text-white/85">{m.name}</span>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full border font-semibold ${
                    m.role === "builder_admin"
                      ? "text-blue-300 bg-blue-500/12 border-blue-400/25"
                      : "text-white/45 bg-white/6 border-white/10"
                  }`}>
                    {m.role === "builder_admin" ? "Admin" : "Member"}
                  </span>
                  {m.invite_status === "pending" && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full border font-semibold text-amber-400 bg-amber-500/10 border-amber-500/20">
                      Invite Pending
                    </span>
                  )}
                </div>
                <p className="text-xs text-white/30 mt-0.5 truncate">{m.email}</p>
              </div>

              {/* Last active */}
              <div className="text-right flex-shrink-0 hidden sm:block">
                <p className="text-[11px] text-white/25">
                  {m.invite_status === "accepted" ? timeAgo(m.last_activity) : m.invite_sent_at ? `Invited ${timeAgo(m.invite_sent_at)}` : "Invited"}
                </p>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 flex-shrink-0">
                {m.invite_status === "pending" && (
                  <button
                    onClick={() => handleResend(m.id)}
                    disabled={resendingId === m.id}
                    className="text-xs px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/8 text-white/40 hover:text-white/70 disabled:opacity-40 transition-colors"
                  >
                    {resendingId === m.id ? "Sending…" : "Resend"}
                  </button>
                )}
                <button
                  onClick={() => handleRemove(m.id)}
                  disabled={removingId === m.id}
                  className="text-xs px-2.5 py-1.5 rounded-lg bg-red-500/8 hover:bg-red-500/15 border border-red-500/15 text-red-400/60 hover:text-red-400 disabled:opacity-40 transition-colors"
                >
                  {removingId === m.id ? "…" : "Remove"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Invite slide-over */}
      {showInvite && (
        <div className="fixed inset-0 z-50 flex">
          <div className="flex-1 bg-black/60 backdrop-blur-sm" onClick={() => setShowInvite(false)} />
          <div ref={panelRef} className="w-[460px] bg-[#0a0a0a] border-l border-white/8 shadow-2xl flex flex-col">
            <div className="flex items-center justify-between px-6 py-5 border-b border-white/8 flex-shrink-0">
              <div>
                <h2 className="font-bold text-white text-lg">Invite Team Member</h2>
                <p className="text-xs text-white/30 mt-0.5">{seatsLeft} seat{seatsLeft !== 1 ? "s" : ""} remaining</p>
              </div>
              <button onClick={() => setShowInvite(false)} className="text-white/25 hover:text-white/60 text-2xl leading-none">×</button>
            </div>

            <form onSubmit={handleInvite} className="flex-1 overflow-y-auto p-6 space-y-5">
              <div>
                <label className="block text-xs font-semibold text-white/40 mb-1.5 uppercase tracking-wide">Full Name *</label>
                <input required value={inviteName} onChange={e => setInviteName(e.target.value)} placeholder="Jane Smith" className={INPUT} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-white/40 mb-1.5 uppercase tracking-wide">Email Address *</label>
                <input required type="email" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} placeholder="jane@company.com" className={INPUT} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-white/40 mb-2 uppercase tracking-wide">Role *</label>
                <div className="space-y-2">
                  {([
                    { id: "builder_admin",  label: "Admin",  desc: "Full portal access, can manage team and settings" },
                    { id: "builder_member", label: "Member", desc: "View dashboard, leads, and analytics" },
                  ] as const).map(r => (
                    <button key={r.id} type="button" onClick={() => setInviteRole(r.id)}
                      className={`w-full flex items-start gap-3 px-4 py-3 rounded-xl border text-left transition-all ${
                        inviteRole === r.id
                          ? "bg-blue-600/12 border-blue-500/40"
                          : "bg-white/3 border-white/8 hover:bg-white/5"
                      }`}>
                      <div className={`w-3.5 h-3.5 rounded-full border-2 mt-0.5 flex-shrink-0 transition-colors ${inviteRole === r.id ? "border-blue-400 bg-blue-400" : "border-white/20"}`} />
                      <div>
                        <p className={`text-sm font-semibold ${inviteRole === r.id ? "text-blue-300" : "text-white/70"}`}>{r.label}</p>
                        <p className="text-xs text-white/30 mt-0.5">{r.desc}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {inviteError && <p className="text-xs text-red-400 bg-red-500/8 rounded-xl px-3 py-2">{inviteError}</p>}
            </form>

            <div className="px-6 py-4 border-t border-white/8 flex-shrink-0">
              <button onClick={handleInvite} disabled={submitting || !inviteName || !inviteEmail}
                className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-sm font-bold transition-colors">
                {submitting ? "Sending Invite…" : "Send Invite"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function TeamPage() {
  return (
    <Suspense fallback={<div className="p-8 text-white/20">Loading…</div>}>
      <TeamContent />
    </Suspense>
  );
}
