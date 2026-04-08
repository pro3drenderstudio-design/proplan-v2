"use client";

import { useEffect, useState } from "react";
import { getAllTeamMembers, createTeamMember, updateTeamMember, deleteTeamMember } from "@/lib/admin-api";
import { TeamMember, TeamRole } from "@/types/database";

const ROLE_STYLE: Record<TeamRole, string> = {
  super_admin:      "text-violet-300 bg-violet-500/15 border-violet-400/30",
  manager:          "text-blue-300 bg-blue-500/15 border-blue-400/30",
  editor:           "text-green-300 bg-green-500/15 border-green-400/30",
  viewer:           "text-white/50 bg-white/6 border-white/15",
  customer_service: "text-amber-300 bg-amber-500/15 border-amber-400/30",
  artist:           "text-pink-300 bg-pink-500/15 border-pink-400/30",
  builder_admin:    "text-sky-300 bg-sky-500/15 border-sky-400/30",
  builder_member:   "text-teal-300 bg-teal-500/15 border-teal-400/30",
};
const ROLE_LABEL: Record<TeamRole, string> = {
  super_admin:      "Super Admin",
  manager:          "Manager",
  editor:           "Editor",
  viewer:           "Viewer",
  customer_service: "Customer Service",
  artist:           "3D Artist",
  builder_admin:    "Builder Admin",
  builder_member:   "Builder Member",
};

function timeAgo(s: string) {
  const d = Date.now() - new Date(s).getTime();
  const m = Math.floor(d / 60000);
  if (m < 1) return "Just now";
  if (m < 60) return `${m} mins ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return new Date(s).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}
function initials(name: string) {
  return name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
}

const BG_COLORS = [
  "from-blue-600 to-blue-800",
  "from-violet-600 to-violet-800",
  "from-green-600 to-green-800",
  "from-amber-600 to-amber-800",
  "from-pink-600 to-pink-800",
  "from-teal-600 to-teal-800",
];

const DEFAULT_PERMISSIONS: Record<string, Record<string, boolean>> = {
  super_admin:      { view_all: true,  edit_builders: true,  manage_team: true,  manage_billing: true,  run_diagnostics: true,  handle_support: true,  run_node_bridge: true  },
  manager:          { view_all: true,  edit_builders: true,  manage_team: false, manage_billing: false, run_diagnostics: true,  handle_support: true,  run_node_bridge: true  },
  editor:           { view_all: true,  edit_builders: false, manage_team: false, manage_billing: false, run_diagnostics: false, handle_support: false, run_node_bridge: false },
  viewer:           { view_all: false, edit_builders: false, manage_team: false, manage_billing: false, run_diagnostics: false, handle_support: false, run_node_bridge: false },
  customer_service: { view_all: false, edit_builders: false, manage_team: false, manage_billing: false, run_diagnostics: false, handle_support: true,  run_node_bridge: false },
  artist:           { view_all: false, edit_builders: false, manage_team: false, manage_billing: false, run_diagnostics: false, handle_support: false, run_node_bridge: true  },
};

const PERMISSION_LABELS: Record<string, string> = {
  view_all:        "View All Projects & Builders",
  edit_builders:   "Edit Builder Accounts",
  manage_team:     "Manage Team Members",
  manage_billing:  "Manage Billing",
  run_diagnostics: "Run System Diagnostics",
  handle_support:  "Handle Support Tickets",
  run_node_bridge: "Access Node Bridge",
};

interface MemberModalProps {
  member?: TeamMember | null;
  onClose: () => void;
  onSaved: () => void;
}

function MemberModal({ member, onClose, onSaved }: MemberModalProps) {
  const [name,   setName]   = useState(member?.name   ?? "");
  const [email,  setEmail]  = useState(member?.email  ?? "");
  const [role,   setRole]   = useState<TeamRole>(member?.role ?? "viewer");
  const [perms,  setPerms]  = useState<Record<string, boolean>>(member?.permissions ?? DEFAULT_PERMISSIONS.viewer);
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState<string | null>(null);

  function handleRoleChange(r: TeamRole) {
    setRole(r);
    setPerms(DEFAULT_PERMISSIONS[r]);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name || !email) { setError("Name and email are required."); return; }
    setSaving(true);
    setError(null);

    if (member) {
      const ok = await updateTeamMember(member.id, { name, role, permissions: perms });
      if (!ok) { setError("Failed to update member. Make sure the team_members table migration has been run."); setSaving(false); return; }
    } else {
      const result = await createTeamMember({ name, email, role, permissions: perms });
      if (!result) { setError("Failed to create member. Make sure the team_members table migration has been run."); setSaving(false); return; }
      // Send invite email
      await fetch("/api/auth/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memberId: result.id }),
      }).catch(err => console.warn("Invite email failed:", err));
    }
    setSaving(false);
    onSaved();
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-[#1a1a1a] border border-white/12 rounded-2xl w-full max-w-lg shadow-2xl">

        <div className="flex items-center justify-between px-6 py-4 border-b border-white/8">
          <h2 className="text-sm font-bold text-white">{member ? "Edit Permissions" : "Add New Team Member"}</h2>
          <button onClick={onClose} className="text-white/35 hover:text-white transition-colors">
            <XIcon className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="bg-red-500/10 border border-red-500/25 rounded-lg px-3 py-2 text-xs text-red-400">{error}</div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[9px] font-bold uppercase tracking-widest text-white/30 mb-1.5">Full Name *</label>
              <input
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Jane Smith"
                required
                disabled={!!member}
                className="w-full bg-[#111] border border-white/12 rounded-lg px-3 py-2 text-xs text-white placeholder-white/20 outline-none focus:border-blue-500/60 disabled:opacity-50"
              />
            </div>
            <div>
              <label className="block text-[9px] font-bold uppercase tracking-widest text-white/30 mb-1.5">Email *</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="jane@proplan.com"
                required
                disabled={!!member}
                className="w-full bg-[#111] border border-white/12 rounded-lg px-3 py-2 text-xs text-white placeholder-white/20 outline-none focus:border-blue-500/60 disabled:opacity-50"
              />
            </div>
          </div>

          <div>
            <label className="block text-[9px] font-bold uppercase tracking-widest text-white/30 mb-2">Role</label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {(["super_admin", "manager", "editor", "viewer", "customer_service", "artist"] as TeamRole[]).map(r => (
                <button
                  key={r}
                  type="button"
                  onClick={() => handleRoleChange(r)}
                  className={`py-2 px-3 rounded-lg border text-[10px] font-bold transition-colors ${
                    role === r
                      ? ROLE_STYLE[r]
                      : "text-white/30 bg-white/4 border-white/10 hover:text-white/60"
                  }`}
                >
                  {ROLE_LABEL[r]}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-[9px] font-bold uppercase tracking-widest text-white/30 mb-2">Permissions</label>
            <div className="bg-[#111] border border-white/8 rounded-xl divide-y divide-white/5">
              {Object.entries(PERMISSION_LABELS).map(([key, label]) => (
                <label key={key} className="flex items-center justify-between px-3 py-2.5 cursor-pointer hover:bg-white/3 transition-colors">
                  <span className="text-xs text-white/60">{label}</span>
                  <input
                    type="checkbox"
                    checked={!!perms[key]}
                    onChange={e => setPerms(prev => ({ ...prev, [key]: e.target.checked }))}
                    className="accent-blue-500 w-3.5 h-3.5"
                  />
                </label>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-3 pt-2">
            <button
              type="submit"
              disabled={saving}
              className="flex-1 py-2.5 bg-blue-600 text-xs text-white font-medium rounded-lg hover:bg-blue-500 transition-colors disabled:opacity-50"
            >
              {saving ? "Saving..." : member ? "Save Changes" : "Add Team Member"}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 border border-white/12 text-xs text-white/50 rounded-lg hover:text-white hover:border-white/25 transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function TeamAccessPage() {
  const [members,    setMembers]    = useState<TeamMember[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [modal,      setModal]      = useState<"add" | TeamMember | null>(null);
  const [deleting,   setDeleting]   = useState<string | null>(null);
  const [resending,  setResending]  = useState<string | null>(null);
  const [page,       setPage]       = useState(1);
  const PER_PAGE = 10;

  async function load() {
    setLoading(true);
    const data = await getAllTeamMembers();
    setMembers(data);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function handleDelete(id: string) {
    if (!confirm("Remove this team member?")) return;
    setDeleting(id);
    await deleteTeamMember(id);
    setMembers(prev => prev.filter(m => m.id !== id));
    setDeleting(null);
  }

  async function handleResendInvite(id: string) {
    setResending(id);
    await fetch("/api/auth/invite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ memberId: id }),
    }).catch(err => console.warn("Resend invite failed:", err));
    setResending(null);
  }

  const paged = members.slice((page - 1) * PER_PAGE, page * PER_PAGE);
  const totalPages = Math.ceil(members.length / PER_PAGE);

  return (
    <div className="flex flex-col h-full overflow-hidden">

      {/* Header */}
      <div className="px-4 md:px-6 py-4 border-b border-white/8 flex-shrink-0 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-base font-bold text-white">Team Management</h1>
          <p className="text-xs text-white/35 mt-0.5 hidden sm:block">Manage team members, roles, and access permissions.</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/12 text-xs text-white/50 hover:text-white hover:border-white/25 transition-colors">
            <FilterIcon className="w-3.5 h-3.5" /> Filter
          </button>
          <button className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/12 text-xs text-white/50 hover:text-white hover:border-white/25 transition-colors">
            <ExportIcon className="w-3.5 h-3.5" /> Export
          </button>
          <button
            onClick={() => setModal("add")}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 text-xs text-white font-medium hover:bg-blue-500 transition-colors"
          >
            <PlusIcon className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Add New Team Member</span>
            <span className="sm:hidden">Add Member</span>
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-y-auto p-6">
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-16 bg-[#1a1a1a] border border-white/8 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : members.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <p className="text-white/20 text-4xl mb-3">👥</p>
            <p className="text-sm text-white/40 font-medium">No team members yet</p>
            <p className="text-xs text-white/25 mt-1 max-w-xs">
              Run the SQL migration in <code className="text-white/40">supabase/builders_team.sql</code> then add your first team member.
            </p>
            <button
              onClick={() => setModal("add")}
              className="mt-4 px-4 py-2 bg-blue-600 text-xs text-white rounded-lg hover:bg-blue-500 transition-colors"
            >
              Add First Member
            </button>
          </div>
        ) : (
          <div className="bg-[#1a1a1a] border border-white/8 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
            <div className="min-w-[600px]">
            {/* Header row */}
            <div className="grid grid-cols-12 gap-4 px-5 py-3 text-[9px] font-bold uppercase tracking-widest text-white/25 border-b border-white/8">
              <div className="col-span-3">Name</div>
              <div className="col-span-3">Email</div>
              <div className="col-span-2">Role</div>
              <div className="col-span-2">Last Activity</div>
              <div className="col-span-2">Actions</div>
            </div>

            <div className="divide-y divide-white/5">
              {paged.map((m, idx) => (
                <div key={m.id} className="grid grid-cols-12 gap-4 items-center px-5 py-4 hover:bg-white/3 transition-colors">
                  {/* Name */}
                  <div className="col-span-3 flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full bg-gradient-to-br ${BG_COLORS[idx % BG_COLORS.length]} flex items-center justify-center flex-shrink-0`}>
                      <span className="text-xs font-bold text-white">{initials(m.name)}</span>
                    </div>
                    <p className="text-sm font-medium text-white/80">{m.name}</p>
                  </div>

                  {/* Email */}
                  <div className="col-span-3">
                    <p className="text-xs text-white/50 truncate">{m.email}</p>
                  </div>

                  {/* Role */}
                  <div className="col-span-2 flex flex-col gap-1">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded border w-fit ${ROLE_STYLE[m.role]}`}>
                      {ROLE_LABEL[m.role]}
                    </span>
                    {m.invite_status === "pending" && (
                      <span className="text-[9px] font-bold text-amber-400/80 uppercase tracking-wider">Invite Pending</span>
                    )}
                  </div>

                  {/* Last Activity */}
                  <div className="col-span-2">
                    <p className="text-xs text-white/40">{timeAgo(m.last_activity)}</p>
                  </div>

                  {/* Actions */}
                  <div className="col-span-2 flex items-center gap-2">
                    {m.invite_status === "pending" ? (
                      <button
                        onClick={() => handleResendInvite(m.id)}
                        disabled={resending === m.id}
                        className="text-[10px] px-2.5 py-1.5 bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-lg hover:bg-amber-500/20 transition-colors disabled:opacity-50"
                      >
                        {resending === m.id ? "Sending…" : "Resend Invite"}
                      </button>
                    ) : (
                      <button
                        onClick={() => setModal(m)}
                        className="text-[10px] px-2.5 py-1.5 bg-white/6 text-white/50 rounded-lg hover:text-white hover:bg-white/10 transition-colors"
                      >
                        Edit Permissions
                      </button>
                    )}
                    <button
                      onClick={() => handleDelete(m.id)}
                      disabled={deleting === m.id}
                      className="w-7 h-7 flex items-center justify-center rounded-lg text-white/25 hover:text-red-400 hover:bg-red-400/10 transition-colors disabled:opacity-50"
                    >
                      <TrashIcon className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
            </div>{/* min-w-[600px] */}
            </div>{/* overflow-x-auto */}

            {/* Pagination */}
            <div className="flex items-center justify-between px-5 py-3 border-t border-white/8">
              <p className="text-xs text-white/30">
                Showing <strong className="text-white/50">{(page - 1) * PER_PAGE + 1}</strong> to{" "}
                <strong className="text-white/50">{Math.min(page * PER_PAGE, members.length)}</strong> of{" "}
                <strong className="text-white/50">{members.length}</strong> members
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="text-xs px-3 py-1.5 border border-white/12 rounded-lg text-white/40 hover:text-white hover:border-white/25 transition-colors disabled:opacity-30"
                >
                  Previous
                </button>
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className="text-xs px-3 py-1.5 border border-white/12 rounded-lg text-white/40 hover:text-white hover:border-white/25 transition-colors disabled:opacity-30"
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Modal */}
      {modal && (
        <MemberModal
          member={modal === "add" ? null : modal}
          onClose={() => setModal(null)}
          onSaved={() => { setModal(null); load(); }}
        />
      )}
    </div>
  );
}

function FilterIcon({ className }: { className?: string }) {
  return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 4h18M7 12h10M11 20h2"/></svg>;
}
function ExportIcon({ className }: { className?: string }) {
  return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>;
}
function PlusIcon({ className }: { className?: string }) {
  return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4"/></svg>;
}
function TrashIcon({ className }: { className?: string }) {
  return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>;
}
function XIcon({ className }: { className?: string }) {
  return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>;
}
