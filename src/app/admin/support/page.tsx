"use client";

import { useEffect, useState } from "react";
import { getSupportTickets, updateSupportTicket, getAllTeamMembers } from "@/lib/admin-api";
import { SupportTicket, TicketStatus, TeamMember } from "@/types/database";

const STATUS_STYLE: Record<TicketStatus, string> = {
  open:        "text-amber-400 bg-amber-400/10 border-amber-400/20",
  in_progress: "text-blue-400 bg-blue-400/10 border-blue-400/20",
  resolved:    "text-green-400 bg-green-400/10 border-green-400/20",
  closed:      "text-white/30 bg-white/5 border-white/10",
};
const STATUS_LABEL: Record<TicketStatus, string> = {
  open:        "Open",
  in_progress: "In Progress",
  resolved:    "Resolved",
  closed:      "Closed",
};
const PRIORITY_STYLE: Record<string, string> = {
  low:    "text-white/40 bg-white/5",
  normal: "text-blue-400 bg-blue-400/10",
  high:   "text-amber-400 bg-amber-400/10",
  urgent: "text-red-400 bg-red-400/10",
};

function timeAgo(s: string) {
  const d = Date.now() - new Date(s).getTime();
  const m = Math.floor(d / 60000);
  if (m < 1) return "Just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return new Date(s).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

interface TicketDrawerProps {
  ticket: SupportTicket;
  teamMembers: TeamMember[];
  onClose: () => void;
  onUpdated: () => void;
}

function TicketDrawer({ ticket, teamMembers, onClose, onUpdated }: TicketDrawerProps) {
  const [status,     setStatus]     = useState<TicketStatus>(ticket.status);
  const [assignedTo, setAssignedTo] = useState(ticket.assigned_to ?? "");
  const [notes,      setNotes]      = useState(ticket.admin_notes ?? "");
  const [saving,     setSaving]     = useState(false);

  async function handleSave() {
    setSaving(true);
    await updateSupportTicket(ticket.id, {
      status,
      assigned_to: assignedTo || null,
      admin_notes: notes || null,
    });
    setSaving(false);
    onUpdated();
  }

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="w-[480px] bg-[#111] border-l border-white/8 flex flex-col overflow-hidden">

        {/* Header */}
        <div className="px-5 py-4 border-b border-white/8 flex items-center justify-between flex-shrink-0">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-white/30 mb-0.5">
              Support Ticket
            </p>
            <h2 className="text-sm font-bold text-white truncate max-w-[340px]">{ticket.subject}</h2>
          </div>
          <button onClick={onClose} className="text-white/30 hover:text-white transition-colors">
            <XIcon className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">

          {/* Meta */}
          <div className="bg-[#1a1a1a] border border-white/8 rounded-xl p-4 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-[9px] font-bold uppercase tracking-widest text-white/25 mb-1">From</p>
                <p className="text-xs text-white/70">{ticket.builder_name ?? "—"}</p>
                <p className="text-[10px] text-white/40">{ticket.builder_email ?? "—"}</p>
              </div>
              <div>
                <p className="text-[9px] font-bold uppercase tracking-widest text-white/25 mb-1">Category</p>
                <p className="text-xs text-white/70 capitalize">{ticket.category}</p>
              </div>
              <div>
                <p className="text-[9px] font-bold uppercase tracking-widest text-white/25 mb-1">Priority</p>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full capitalize ${PRIORITY_STYLE[ticket.priority]}`}>
                  {ticket.priority}
                </span>
              </div>
              <div>
                <p className="text-[9px] font-bold uppercase tracking-widest text-white/25 mb-1">Submitted</p>
                <p className="text-xs text-white/50">{new Date(ticket.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</p>
              </div>
            </div>
          </div>

          {/* Message */}
          <div>
            <p className="text-[9px] font-bold uppercase tracking-widest text-white/25 mb-2">Message</p>
            <div className="bg-[#1a1a1a] border border-white/8 rounded-xl p-4">
              <p className="text-xs text-white/60 leading-relaxed whitespace-pre-wrap">{ticket.message}</p>
            </div>
          </div>

          {/* Status */}
          <div>
            <label className="block text-[9px] font-bold uppercase tracking-widest text-white/25 mb-2">Status</label>
            <div className="grid grid-cols-2 gap-2">
              {(["open","in_progress","resolved","closed"] as TicketStatus[]).map(s => (
                <button key={s} type="button" onClick={() => setStatus(s)}
                  className={`py-2 px-3 rounded-lg border text-[10px] font-bold transition-colors ${
                    status === s ? STATUS_STYLE[s] : "text-white/30 bg-white/4 border-white/10 hover:text-white/60"
                  }`}>
                  {STATUS_LABEL[s]}
                </button>
              ))}
            </div>
          </div>

          {/* Assign to */}
          <div>
            <label className="block text-[9px] font-bold uppercase tracking-widest text-white/25 mb-2">Assign To</label>
            <select
              value={assignedTo}
              onChange={e => setAssignedTo(e.target.value)}
              className="w-full bg-[#1a1a1a] border border-white/12 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-blue-500/60"
            >
              <option value="">Unassigned</option>
              {teamMembers.map(m => (
                <option key={m.id} value={m.name}>{m.name} ({m.role.replace("_", " ")})</option>
              ))}
            </select>
          </div>

          {/* Admin notes */}
          <div>
            <label className="block text-[9px] font-bold uppercase tracking-widest text-white/25 mb-2">Internal Notes</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={4}
              placeholder="Add internal notes visible only to staff..."
              className="w-full bg-[#1a1a1a] border border-white/12 rounded-xl px-3 py-2.5 text-xs text-white/70 placeholder-white/20 outline-none focus:border-blue-500/60 resize-none"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-white/8 flex gap-3 flex-shrink-0">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 py-2.5 bg-blue-600 text-xs text-white font-medium rounded-lg hover:bg-blue-500 transition-colors disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save Changes"}
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2.5 border border-white/12 text-xs text-white/50 rounded-lg hover:text-white hover:border-white/25 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

export default function SupportTicketsPage() {
  const [tickets,     setTickets]     = useState<SupportTicket[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [noTable,     setNoTable]     = useState(false);
  const [selected,    setSelected]    = useState<SupportTicket | null>(null);
  const [statusFilter, setStatusFilter] = useState<TicketStatus | "all">("all");

  async function load() {
    const [t, m] = await Promise.all([getSupportTickets(), getAllTeamMembers()]);
    setTickets(t);
    setTeamMembers(m);
    // If tickets come back as empty array and there was an error, the table likely doesn't exist
    setNoTable(false);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  const filtered = statusFilter === "all" ? tickets : tickets.filter(t => t.status === statusFilter);

  const counts = {
    all:         tickets.length,
    open:        tickets.filter(t => t.status === "open").length,
    in_progress: tickets.filter(t => t.status === "in_progress").length,
    resolved:    tickets.filter(t => t.status === "resolved").length,
    closed:      tickets.filter(t => t.status === "closed").length,
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">

      {/* Header */}
      <div className="px-6 py-4 border-b border-white/8 flex-shrink-0 flex items-center justify-between">
        <div>
          <h1 className="text-base font-bold text-white">Support Tickets</h1>
          <p className="text-xs text-white/35 mt-0.5">Builder support requests and helpdesk queue.</p>
        </div>
        <div className="flex items-center gap-2 text-xs text-white/40">
          <span className="w-2 h-2 rounded-full bg-amber-400" />
          {counts.open} open · {counts.in_progress} in progress
        </div>
      </div>

      {/* Filter tabs */}
      <div className="px-6 border-b border-white/8 flex-shrink-0">
        <div className="flex items-center gap-0 -mb-px">
          {([
            { key: "all",         label: "All",         count: counts.all },
            { key: "open",        label: "Open",        count: counts.open },
            { key: "in_progress", label: "In Progress", count: counts.in_progress },
            { key: "resolved",    label: "Resolved",    count: counts.resolved },
            { key: "closed",      label: "Closed",      count: counts.closed },
          ] as { key: TicketStatus | "all"; label: string; count: number }[]).map(tab => (
            <button key={tab.key} onClick={() => setStatusFilter(tab.key)}
              className={`flex items-center gap-1.5 px-4 py-3 text-xs font-medium border-b-2 transition-colors ${
                statusFilter === tab.key
                  ? "border-blue-500 text-blue-400"
                  : "border-transparent text-white/40 hover:text-white"
              }`}>
              {tab.label}
              {tab.count > 0 && (
                <span className="text-[9px] bg-white/10 px-1.5 py-0.5 rounded-full">{tab.count}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-y-auto p-6">
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-16 bg-[#1a1a1a] border border-white/8 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : noTable ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <p className="text-white/20 text-4xl mb-3">🗄️</p>
            <p className="text-sm text-white/40 font-medium">support_tickets table not set up</p>
            <p className="text-xs text-white/25 mt-1 max-w-xs">
              Run the SQL migration to create the <code className="text-white/40">support_tickets</code> table in your Supabase project.
            </p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <p className="text-white/20 text-4xl mb-3">✅</p>
            <p className="text-sm text-white/40 font-medium">
              {statusFilter === "all" ? "No tickets yet" : `No ${STATUS_LABEL[statusFilter as TicketStatus]?.toLowerCase()} tickets`}
            </p>
            <p className="text-xs text-white/25 mt-1">Tickets submitted by builders via the support form will appear here.</p>
          </div>
        ) : (
          <div className="bg-[#1a1a1a] border border-white/8 rounded-xl overflow-hidden">
            {/* Column headers */}
            <div className="grid grid-cols-12 gap-4 px-5 py-3 text-[9px] font-bold uppercase tracking-widest text-white/25 border-b border-white/8">
              <div className="col-span-4">Subject</div>
              <div className="col-span-2">Builder</div>
              <div className="col-span-2">Category</div>
              <div className="col-span-1">Priority</div>
              <div className="col-span-1">Status</div>
              <div className="col-span-1">Assigned</div>
              <div className="col-span-1">Time</div>
            </div>

            <div className="divide-y divide-white/5">
              {filtered.map(ticket => (
                <div
                  key={ticket.id}
                  onClick={() => setSelected(ticket)}
                  className="grid grid-cols-12 gap-4 items-center px-5 py-4 hover:bg-white/3 transition-colors cursor-pointer"
                >
                  <div className="col-span-4">
                    <p className="text-sm font-medium text-white/80 truncate">{ticket.subject}</p>
                    {ticket.admin_notes && (
                      <p className="text-[10px] text-white/30 truncate mt-0.5">{ticket.admin_notes}</p>
                    )}
                  </div>
                  <div className="col-span-2">
                    <p className="text-xs text-white/60 truncate">{ticket.builder_name ?? "—"}</p>
                    <p className="text-[10px] text-white/30 truncate">{ticket.builder_email ?? ""}</p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-xs text-white/50 capitalize">{ticket.category}</p>
                  </div>
                  <div className="col-span-1">
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full capitalize ${PRIORITY_STYLE[ticket.priority]}`}>
                      {ticket.priority}
                    </span>
                  </div>
                  <div className="col-span-1">
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${STATUS_STYLE[ticket.status]}`}>
                      {STATUS_LABEL[ticket.status]}
                    </span>
                  </div>
                  <div className="col-span-1">
                    <p className="text-[10px] text-white/35 truncate">{ticket.assigned_to ?? "—"}</p>
                  </div>
                  <div className="col-span-1">
                    <p className="text-[10px] text-white/30">{timeAgo(ticket.created_at)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Ticket detail drawer */}
      {selected && (
        <TicketDrawer
          ticket={selected}
          teamMembers={teamMembers}
          onClose={() => setSelected(null)}
          onUpdated={() => { setSelected(null); load(); }}
        />
      )}
    </div>
  );
}

function XIcon({ className }: { className?: string }) {
  return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>;
}
