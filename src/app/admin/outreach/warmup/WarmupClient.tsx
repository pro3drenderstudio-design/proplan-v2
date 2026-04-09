"use client";
import { useEffect, useState } from "react";
import { getInboxes, updateInbox } from "@/lib/outreach/api";
import type { OutreachInboxSafe, WarmupPoolStats } from "@/types/outreach";

export default function WarmupClient() {
  const [inboxes, setInboxes]     = useState<OutreachInboxSafe[]>([]);
  const [stats, setStats]         = useState<WarmupPoolStats | null>(null);
  const [loading, setLoading]     = useState(true);
  const [saving, setSaving]       = useState<string | null>(null);
  const [testing, setTesting]     = useState<string | null>(null);
  const [testResult, setTestResult] = useState<Record<string, string>>({});
  const [edits, setEdits]         = useState<Record<string, Partial<OutreachInboxSafe>>>({});
  const [page, setPage]           = useState(0);
  const PAGE_SIZE = 10;

  useEffect(() => {
    Promise.all([
      getInboxes(),
      fetch("/api/outreach/warmup/stats").then((r) => r.json()).catch(() => null),
    ]).then(([inboxList, poolStats]) => {
      setInboxes(inboxList);
      setStats(poolStats);
      setLoading(false);
    });
  }, []);

  function getField<K extends keyof OutreachInboxSafe>(inbox: OutreachInboxSafe, key: K): OutreachInboxSafe[K] {
    return (edits[inbox.id]?.[key] ?? inbox[key]) as OutreachInboxSafe[K];
  }
  function setField(inboxId: string, key: keyof OutreachInboxSafe, value: unknown) {
    setEdits(e => ({ ...e, [inboxId]: { ...e[inboxId], [key]: value } }));
  }

  async function handleSave(inbox: OutreachInboxSafe) {
    const diff = edits[inbox.id];
    if (!diff) return;
    setSaving(inbox.id);
    await updateInbox(inbox.id, diff);
    setInboxes(prev => prev.map(i => i.id === inbox.id ? { ...i, ...diff } : i));
    setEdits(e => { const n = { ...e }; delete n[inbox.id]; return n; });
    setSaving(null);
  }

  async function handleTestDeliverability(inbox: OutreachInboxSafe) {
    setTesting(inbox.id);
    try {
      const r = await fetch(`/api/outreach/inboxes/${inbox.id}/test-deliverability`, { method: "POST" });
      const data = await r.json();
      setTestResult(prev => ({ ...prev, [inbox.id]: data.message ?? (data.error ? `Error: ${data.error}` : "Sent") }));
    } catch {
      setTestResult(prev => ({ ...prev, [inbox.id]: "Request failed" }));
    }
    setTesting(null);
    setTimeout(() => setTestResult(prev => { const n = { ...prev }; delete n[inbox.id]; return n; }), 6000);
  }

  if (loading) return (
    <div className="p-6 space-y-4">
      {[1,2,3].map(i => <div key={i} className="h-32 bg-white/4 rounded-xl animate-pulse" />)}
    </div>
  );

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-white">Inbox Warmup</h1>
        <p className="text-white/40 text-sm mt-0.5">Gradually ramp up sending volume to build sender reputation</p>
      </div>

      {/* Pool stats panel */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          {[
            { label: "Pool size",       value: stats.pool_size,            suffix: " inboxes" },
            { label: "Sent today",      value: stats.sent_today,           suffix: " emails" },
            { label: "Rescued (7d)",    value: stats.rescued_from_spam_7d, suffix: " from spam" },
            { label: "Reply rate (7d)", value: `${Math.round(stats.reply_rate_7d * 100)}`,  suffix: "%" },
          ].map((stat) => (
            <div key={stat.label} className="bg-white/4 border border-white/8 rounded-xl p-4">
              <p className="text-white/40 text-xs font-medium">{stat.label}</p>
              <p className="text-white font-bold text-xl mt-1">{stat.value}<span className="text-white/30 text-sm font-normal">{stat.suffix}</span></p>
            </div>
          ))}
        </div>
      )}

      {inboxes.length === 0 ? (
        <div className="text-center py-16 text-white/30">
          <p>No inboxes yet. <a href="/admin/outreach/inboxes/new" className="text-blue-400">Add an inbox first.</a></p>
        </div>
      ) : (
        <>
        <div className="space-y-4">
          {inboxes.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE).map((inbox) => {
            const current = getField(inbox, "warmup_current_daily") as number;
            const target  = getField(inbox, "warmup_target_daily") as number;
            const ramp    = getField(inbox, "warmup_ramp_per_week") as number;
            const enabled = getField(inbox, "warmup_enabled") as boolean;
            const pct     = target > 0 ? Math.min(100, Math.round((current / target) * 100)) : 0;
            const isDirty = !!edits[inbox.id];

            return (
              <div key={inbox.id} className="bg-white/4 border border-white/8 rounded-xl p-5 space-y-4">
                {/* Inbox header */}
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-white font-medium text-sm">{inbox.label}</p>
                    <p className="text-white/35 text-xs">{inbox.email_address} · {inbox.provider.toUpperCase()}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => handleTestDeliverability(inbox)}
                      disabled={testing === inbox.id}
                      className="px-3 py-1.5 bg-white/6 hover:bg-white/10 text-white/60 hover:text-white text-xs font-medium rounded-lg transition-colors disabled:opacity-40"
                    >
                      {testing === inbox.id ? "Sending…" : "Test Deliverability"}
                    </button>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <span className="text-white/40 text-xs">Warmup</span>
                      <div
                        onClick={() => setField(inbox.id, "warmup_enabled", !enabled)}
                        className={`w-9 h-5 rounded-full transition-colors cursor-pointer flex items-center px-0.5 ${enabled ? "bg-green-500" : "bg-white/15"}`}
                      >
                        <div className={`w-4 h-4 rounded-full bg-white shadow transition-transform ${enabled ? "translate-x-4" : "translate-x-0"}`} />
                      </div>
                    </label>
                  </div>
                </div>

                {/* Deliverability test result */}
                {testResult[inbox.id] && (
                  <div className={`text-xs px-3 py-2 rounded-lg ${testResult[inbox.id].startsWith("Error") ? "bg-red-500/10 text-red-400" : "bg-green-500/10 text-green-400"}`}>
                    {testResult[inbox.id]}
                  </div>
                )}

                {/* Progress bar */}
                <div>
                  <div className="flex justify-between text-xs text-white/40 mb-1.5">
                    <span>Current daily: <span className="text-white/70 font-semibold">{current}</span></span>
                    <span>Target: <span className="text-white/70 font-semibold">{target}</span></span>
                  </div>
                  <div className="h-2 bg-white/8 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${pct >= 100 ? "bg-green-500" : "bg-blue-500"}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <p className="text-white/25 text-[10px] mt-1">{pct}% of target reached</p>
                </div>

                {/* Settings */}
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[10px] font-semibold text-white/35 uppercase tracking-wider mb-1">Current Daily</label>
                    <input
                      type="number"
                      value={current}
                      onChange={(e) => setField(inbox.id, "warmup_current_daily", parseInt(e.target.value) || 0)}
                      min={0}
                      className="w-full bg-white/6 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500/50"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-white/35 uppercase tracking-wider mb-1">Target Daily</label>
                    <input
                      type="number"
                      value={target}
                      onChange={(e) => setField(inbox.id, "warmup_target_daily", parseInt(e.target.value) || 0)}
                      min={1}
                      className="w-full bg-white/6 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500/50"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-white/35 uppercase tracking-wider mb-1">Ramp/Week</label>
                    <input
                      type="number"
                      value={ramp}
                      onChange={(e) => setField(inbox.id, "warmup_ramp_per_week", parseInt(e.target.value) || 0)}
                      min={1}
                      className="w-full bg-white/6 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500/50"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <p className="text-white/25 text-xs">
                    {enabled
                      ? `Auto-increments by ${ramp}/week every Monday. ${current < target ? `~${Math.ceil((target - current) / ramp)} week${Math.ceil((target - current) / ramp) !== 1 ? "s" : ""} to reach target.` : "Target reached."}`
                      : "Warmup disabled — volume stays fixed at daily_send_limit."}
                  </p>
                  {isDirty && (
                    <button
                      onClick={() => handleSave(inbox)}
                      disabled={saving === inbox.id}
                      className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-semibold rounded-lg transition-colors flex-shrink-0 ml-3"
                    >
                      {saving === inbox.id ? "Saving…" : "Save"}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Pagination */}
        {inboxes.length > PAGE_SIZE && (
          <div className="flex items-center justify-between mt-4 pt-4 border-t border-white/8">
            <span className="text-white/30 text-xs">
              Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, inboxes.length)} of {inboxes.length}
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
                className="px-3 py-1.5 bg-white/6 hover:bg-white/10 disabled:opacity-30 text-white/60 text-xs font-medium rounded-lg transition-colors"
              >
                ← Prev
              </button>
              <span className="text-white/40 text-xs">Page {page + 1} / {Math.ceil(inboxes.length / PAGE_SIZE)}</span>
              <button
                onClick={() => setPage((p) => Math.min(Math.ceil(inboxes.length / PAGE_SIZE) - 1, p + 1))}
                disabled={(page + 1) * PAGE_SIZE >= inboxes.length}
                className="px-3 py-1.5 bg-white/6 hover:bg-white/10 disabled:opacity-30 text-white/60 text-xs font-medium rounded-lg transition-colors"
              >
                Next →
              </button>
            </div>
          </div>
        )}
        </>
      )}
    </div>
  );
}
