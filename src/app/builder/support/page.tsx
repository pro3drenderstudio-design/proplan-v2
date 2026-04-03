"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";

type TicketStatus   = "open" | "in_progress" | "resolved";
type TicketPriority = "low" | "normal" | "high" | "urgent";

interface Ticket {
  id: string;
  subject: string;
  category: string;
  priority: TicketPriority;
  status: TicketStatus;
  message: string;
  created_at: string;
  updated_at: string;
}

const MOCK_TICKETS: Ticket[] = [
  { id: "TKT-001", subject: "Camera position not saving", category: "Node Bridge", priority: "high", status: "in_progress", message: "When I click Set Camera in the node bridge, it shows success but doesn't persist.", created_at: "2026-03-29T10:00:00Z", updated_at: "2026-03-30T14:00:00Z" },
  { id: "TKT-002", subject: "Request status update for The Cypress", category: "Project Request", priority: "normal", status: "resolved", message: "What is the current status of my project request submitted on March 15?", created_at: "2026-03-20T09:00:00Z", updated_at: "2026-03-22T11:00:00Z" },
];

const STATUS_STYLE: Record<TicketStatus, string> = {
  open:        "bg-blue-500/12 text-blue-400 border border-blue-500/20",
  in_progress: "bg-amber-500/12 text-amber-400 border border-amber-500/20",
  resolved:    "bg-emerald-500/12 text-emerald-400 border border-emerald-500/20",
};

const PRIORITY_STYLE: Record<TicketPriority, string> = {
  low:    "bg-white/5 text-white/30 border border-white/8",
  normal: "bg-white/6 text-white/40 border border-white/10",
  high:   "bg-amber-500/12 text-amber-400 border border-amber-500/20",
  urgent: "bg-red-500/12 text-red-400 border border-red-500/20",
};

const FAQ = [
  { q: "How long does it take to build a 3D model?", a: "Typically 5–10 business days depending on the complexity of the home design. You'll receive status updates in the Projects tab." },
  { q: "Can I have multiple home models / floor plans?", a: "Yes. Each project request creates a separate configurator. Submit a request for each plan you'd like to offer." },
  { q: "How do leads reach me from the configurator?", a: "Visitors who submit a contact form during configuration are captured as leads in the Leads CRM tab with their full configuration summary." },
  { q: "Can I embed the configurator on my own website?", a: "Yes. Go to My Projects, find the project, and click 'Copy Link' or use the embed code. The configurator works in any iframe." },
  { q: "How do I update option prices?", a: "Prices are managed in the Node Bridge under your project's options. Update the price_impact field for each option." },
  { q: "Can I white-label the configurator with my branding?", a: "Yes. Set your brand color and logo in Settings > Company Profile. These are applied to the configurator automatically." },
];

const EMPTY_FORM = { subject: "", category: "General", priority: "normal" as TicketPriority, message: "" };

const INPUT = "w-full bg-[#141414] border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white/80 placeholder-white/20 focus:outline-none focus:ring-1 focus:ring-blue-500/60 focus:border-blue-500/40 transition-colors";

export default function SupportPage() {
  const [tab,         setTab]         = useState<"tickets" | "new" | "faq">("tickets");
  const [tickets,     setTickets]     = useState<Ticket[]>([]);
  const [form,        setForm]        = useState(EMPTY_FORM);
  const [submitting,  setSubmitting]  = useState(false);
  const [submitted,   setSubmitted]   = useState(false);
  const [openFaq,     setOpenFaq]     = useState<number | null>(null);
  const [selected,    setSelected]    = useState<Ticket | null>(null);
  const [builderName,  setBuilderName]  = useState("");
  const [builderEmail, setBuilderEmail] = useState("");

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      setBuilderEmail(user.email ?? "");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (supabase.from("profiles") as any)
        .select("full_name").eq("id", user.id).single()
        .then(({ data }: { data: { full_name: string } | null }) => {
          if (data?.full_name) setBuilderName(data.full_name);
        });
    });
  }, []);

  function set(key: keyof typeof EMPTY_FORM, val: string) {
    setForm(prev => ({ ...prev, [key]: val }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    await fetch("/api/support", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, builderName, builderEmail }),
    });
    const ticket: Ticket = {
      id: `TKT-${String(tickets.length + 1).padStart(3, "0")}`,
      subject: form.subject,
      category: form.category,
      priority: form.priority,
      status: "open",
      message: form.message,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    setTickets(prev => [ticket, ...prev]);
    setSubmitting(false);
    setSubmitted(true);
    setTimeout(() => {
      setSubmitted(false);
      setForm(EMPTY_FORM);
      setTab("tickets");
    }, 2000);
  }

  return (
    <div className="p-8 max-w-5xl mx-auto">

      <div className="mb-8">
        <h1
          className="text-2xl font-extrabold text-white tracking-tight"
          style={{ fontFamily: "var(--font-syne), sans-serif" }}
        >
          Support
        </h1>
        <p className="text-sm text-white/30 mt-0.5">Get help from our team or browse common questions.</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-white/8 mb-8">
        {[
          { id: "tickets", label: `My Tickets (${tickets.length})` },
          { id: "new",     label: "New Ticket" },
          { id: "faq",     label: "Knowledge Base" },
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id as typeof tab)}
            className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors -mb-px ${
              tab === t.id ? "border-blue-500 text-blue-400" : "border-transparent text-white/35 hover:text-white/60"
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Tickets list */}
      {tab === "tickets" && (
        <div className="flex gap-5">
          <div className={`flex-1 bg-[#0e0e0e] rounded-2xl border border-white/8 overflow-hidden ${selected ? "max-w-[calc(100%-300px)]" : ""}`}>
            {tickets.length === 0 ? (
              <div className="py-16 text-center">
                <div className="w-12 h-12 rounded-2xl bg-white/4 border border-white/8 flex items-center justify-center mx-auto mb-3">
                  <svg className="w-5 h-5 text-white/20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z" />
                  </svg>
                </div>
                <p className="text-white/25 text-sm mb-3">No tickets yet.</p>
                <button onClick={() => setTab("new")} className="text-blue-400 text-sm font-medium hover:text-blue-300 transition-colors">
                  Create your first ticket →
                </button>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/8 bg-white/3">
                    {["Ticket", "Category", "Priority", "Status", "Updated"].map(h => (
                      <th key={h} className="text-left px-5 py-3 text-[10px] font-semibold text-white/25 uppercase tracking-widest">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {tickets.map(ticket => (
                    <tr key={ticket.id} onClick={() => setSelected(ticket)}
                      className={`cursor-pointer hover:bg-white/3 transition-colors ${selected?.id === ticket.id ? "bg-blue-600/5" : ""}`}>
                      <td className="px-5 py-3.5">
                        <p className="font-semibold text-white/80 text-sm">{ticket.subject}</p>
                        <p className="text-xs text-white/30 font-mono">{ticket.id}</p>
                      </td>
                      <td className="px-5 py-3.5 text-white/40 text-xs">{ticket.category}</td>
                      <td className="px-5 py-3.5">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${PRIORITY_STYLE[ticket.priority]}`}>
                          {ticket.priority}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${STATUS_STYLE[ticket.status]}`}>
                          {ticket.status.replace("_", " ").replace(/\b\w/g, c => c.toUpperCase())}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-white/25 text-xs">
                        {new Date(ticket.updated_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Ticket detail */}
          {selected && (
            <div className="w-72 flex-shrink-0 bg-[#0e0e0e] rounded-2xl border border-white/8 p-5 self-start">
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs font-mono text-white/30">{selected.id}</span>
                <button onClick={() => setSelected(null)} className="text-white/25 hover:text-white/60 text-lg leading-none transition-colors">×</button>
              </div>
              <h3
                className="font-bold text-white/80 mb-3"
                style={{ fontFamily: "var(--font-syne), sans-serif" }}
              >
                {selected.subject}
              </h3>
              <div className="flex gap-2 mb-4">
                <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${STATUS_STYLE[selected.status]}`}>
                  {selected.status.replace("_", " ").replace(/\b\w/g, c => c.toUpperCase())}
                </span>
                <span className={`text-xs px-2.5 py-1 rounded-full font-medium capitalize ${PRIORITY_STYLE[selected.priority]}`}>
                  {selected.priority}
                </span>
              </div>
              <p className="text-sm text-white/50 leading-relaxed mb-4">{selected.message}</p>
              <div className="text-xs text-white/25 space-y-1.5 border-t border-white/8 pt-3">
                <div className="flex justify-between">
                  <span>Category</span><span className="text-white/50">{selected.category}</span>
                </div>
                <div className="flex justify-between">
                  <span>Opened</span>
                  <span className="text-white/50">
                    {new Date(selected.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                  </span>
                </div>
              </div>
              {selected.status !== "resolved" && (
                <button className="mt-4 w-full py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold transition-colors shadow-lg shadow-blue-600/20">
                  Reply to Ticket
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* New ticket form */}
      {tab === "new" && (
        <div className="max-w-2xl bg-[#0e0e0e] rounded-2xl border border-white/8 p-6">
          {submitted ? (
            <div className="py-10 text-center">
              <div className="w-16 h-16 rounded-2xl bg-emerald-500/12 border border-emerald-500/20 flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <p
                className="font-bold text-white text-xl"
                style={{ fontFamily: "var(--font-syne), sans-serif" }}
              >
                Ticket Submitted
              </p>
              <p className="text-white/40 text-sm mt-1">We'll respond within 1 business day.</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-xs font-semibold text-white/40 mb-1.5 uppercase tracking-wide">Subject *</label>
                <input required value={form.subject} onChange={e => set("subject", e.target.value)}
                  placeholder="Brief description of your issue"
                  className={INPUT} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-white/40 mb-1.5 uppercase tracking-wide">Category</label>
                  <select value={form.category} onChange={e => set("category", e.target.value)}
                    className={INPUT}>
                    {["General", "Project Request", "Node Bridge", "Leads CRM", "Billing", "Technical Issue"].map(c => (
                      <option key={c} className="bg-[#141414]">{c}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-white/40 mb-1.5 uppercase tracking-wide">Priority</label>
                  <select value={form.priority} onChange={e => set("priority", e.target.value as TicketPriority)}
                    className={INPUT}>
                    <option value="low" className="bg-[#141414]">Low</option>
                    <option value="normal" className="bg-[#141414]">Normal</option>
                    <option value="high" className="bg-[#141414]">High</option>
                    <option value="urgent" className="bg-[#141414]">Urgent</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-white/40 mb-1.5 uppercase tracking-wide">Message *</label>
                <textarea required rows={5} value={form.message} onChange={e => set("message", e.target.value)}
                  placeholder="Describe your issue in detail. Include steps to reproduce if relevant."
                  className={INPUT + " resize-none"} />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setTab("tickets")}
                  className="px-5 py-2.5 rounded-xl border border-white/10 text-sm font-medium text-white/40 hover:text-white/70 hover:bg-white/5 transition-colors">
                  Cancel
                </button>
                <button type="submit" disabled={submitting}
                  className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-semibold transition-colors shadow-lg shadow-blue-600/20">
                  {submitting ? "Submitting…" : "Submit Ticket"}
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {/* Knowledge base */}
      {tab === "faq" && (
        <div className="max-w-2xl space-y-2">
          {FAQ.map((item, i) => (
            <div key={i} className="bg-[#0e0e0e] rounded-2xl border border-white/8 overflow-hidden hover:border-white/14 transition-colors">
              <button
                onClick={() => setOpenFaq(openFaq === i ? null : i)}
                className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-white/3 transition-colors">
                <span className="font-semibold text-white/70 text-sm">{item.q}</span>
                <span className={`text-white/30 text-lg leading-none transition-transform flex-shrink-0 ml-3 ${openFaq === i ? "rotate-45" : ""}`}>+</span>
              </button>
              {openFaq === i && (
                <div className="px-5 pb-4 text-sm text-white/45 leading-relaxed border-t border-white/6 pt-3">
                  {item.a}
                </div>
              )}
            </div>
          ))}
          <div className="bg-blue-600/8 border border-blue-500/20 rounded-2xl p-5 mt-6">
            <p
              className="font-bold text-white text-sm mb-1"
              style={{ fontFamily: "var(--font-syne), sans-serif" }}
            >
              Still need help?
            </p>
            <p className="text-white/40 text-sm mb-3">Can't find your answer? Our team typically responds within a few hours.</p>
            <button onClick={() => setTab("new")}
              className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold transition-colors shadow-lg shadow-blue-600/20">
              Open a Ticket
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
