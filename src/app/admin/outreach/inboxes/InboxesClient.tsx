"use client";
import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { getInboxes, deleteInbox, updateInbox, importInboxes } from "@/lib/outreach/api";
import type { OutreachInboxSafe, InboxImportResult } from "@/types/outreach";

const CSV_TEMPLATE_HEADERS = "email,smtp_host,smtp_user,smtp_pass,label,smtp_port,imap_host,imap_port,daily_limit,timezone,send_window_start,send_window_end,warmup_target";
const CSV_TEMPLATE_ROWS = [
  "you@gmail.com,smtp.gmail.com,you@gmail.com,your-app-password,My Gmail,587,,993,50,America/New_York,09:00,17:00,50",
  "you@outlook.com,smtp-mail.outlook.com,you@outlook.com,your-app-password,My Outlook,587,,993,50,America/New_York,09:00,17:00,50",
  "you@yourdomain.com,mail.yourdomain.com,you@yourdomain.com,your-password,Custom SMTP,587,,993,80,America/New_York,08:00,18:00,80",
].join("\n");

function downloadTemplate() {
  const content = `${CSV_TEMPLATE_HEADERS}\n${CSV_TEMPLATE_ROWS}\n`;
  const blob = new Blob([content], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = "inboxes-template.csv"; a.click();
  URL.revokeObjectURL(url);
}

const PROVIDER_COLORS: Record<string, string> = {
  gmail:   "#ef4444",
  outlook: "#3b82f6",
  smtp:    "#a855f7",
};

export default function InboxesClient() {
  const params = useSearchParams();
  const [inboxes, setInboxes]           = useState<OutreachInboxSafe[]>([]);
  const [loading, setLoading]           = useState(true);
  const [toast, setToast]               = useState<string | null>(null);
  const [showImport, setShowImport]     = useState(false);
  const [importFile, setImportFile]     = useState<File | null>(null);
  const [importing, setImporting]       = useState(false);
  const [importResult, setImportResult] = useState<InboxImportResult | null>(null);
  const [page, setPage]                 = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);
  const PAGE_SIZE = 10;

  useEffect(() => {
    const success = params.get("success");
    const error   = params.get("error");
    if (success === "gmail")         showToast("Gmail inbox connected successfully");
    if (success === "microsoft")     showToast("Microsoft inbox connected successfully");
    if (success === "admin_consent") showToast("Admin consent granted — you can now connect individual inboxes");
    if (error)                       showToast(`Error: ${decodeURIComponent(error)}`, true);
  }, [params]);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    setInboxes(await getInboxes());
    setLoading(false);
  }

  function showToast(msg: string, isError = false) {
    setToast(msg);
    setTimeout(() => setToast(null), 4000);
  }

  async function handleDelete(id: string, label: string) {
    if (!confirm(`Remove inbox "${label}"? This will stop all campaigns using it.`)) return;
    await deleteInbox(id);
    load();
  }

  async function handleImport() {
    if (!importFile) return;
    setImporting(true);
    setImportResult(null);
    const result = await importInboxes(importFile);
    setImportResult(result);
    setImporting(false);
    if (result.imported > 0) {
      showToast(`Imported ${result.imported} inbox${result.imported !== 1 ? "es" : ""}`);
      load();
    }
    setImportFile(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  async function toggleStatus(inbox: OutreachInboxSafe) {
    const newStatus = inbox.status === "active" ? "paused" : "active";
    await updateInbox(inbox.id, { status: newStatus });
    load();
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-xl text-sm font-medium shadow-xl ${toast.startsWith("Error") ? "bg-red-500/20 border border-red-500/40 text-red-300" : "bg-green-500/20 border border-green-500/40 text-green-300"}`}>
          {toast}
        </div>
      )}

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-white">Connected Inboxes</h1>
          <p className="text-white/40 text-sm mt-0.5">Manage sending accounts for cold outreach</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => { setShowImport(true); setImportResult(null); }}
            className="px-4 py-2 bg-white/8 hover:bg-white/12 text-white/70 hover:text-white rounded-xl text-sm font-semibold transition-colors border border-white/10"
          >
            Import CSV
          </button>
          <Link href="/admin/outreach/inboxes/new" className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm font-semibold transition-colors">
            + Add Inbox
          </Link>
        </div>
      </div>

      {/* Admin consent banner — shown when Outlook inboxes exist without OAuth */}
      {!loading && inboxes.some((i) => i.provider === "outlook" && !i.has_oauth) && (
        <div className="mb-5 bg-amber-500/8 border border-amber-500/25 rounded-xl p-4 flex items-start gap-3">
          <span className="text-amber-400 text-lg flex-shrink-0">⚠</span>
          <div className="flex-1 min-w-0">
            <p className="text-amber-300 text-sm font-semibold">Microsoft admin consent required</p>
            <p className="text-white/40 text-xs mt-0.5">
              Your Microsoft 365 tenant requires an admin to approve this app before individual inboxes can connect.
              Grant consent once and all inboxes can connect without this prompt.
            </p>
          </div>
          <a
            href="/api/outreach/inboxes/oauth/microsoft?admin_consent=1"
            className="flex-shrink-0 px-4 py-2 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap"
          >
            Grant Admin Consent →
          </a>
        </div>
      )}

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 bg-white/4 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : inboxes.length === 0 ? (
        <div className="text-center py-20 text-white/30">
          <div className="text-4xl mb-4">📬</div>
          <p className="font-medium">No inboxes connected yet</p>
          <p className="text-sm mt-1">Add a Gmail, Outlook, or SMTP inbox to start sending</p>
        </div>
      ) : (
        <>
        <div className="space-y-3">
          {inboxes.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE).map((inbox) => {
            const color = PROVIDER_COLORS[inbox.provider] ?? "#888";
            return (
              <div key={inbox.id} className="bg-white/4 border border-white/8 rounded-xl p-4 flex items-center gap-4">
                {/* Provider badge */}
                <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: `${color}20`, border: `1px solid ${color}40` }}>
                  <span className="text-xs font-bold" style={{ color }}>{inbox.provider.toUpperCase().slice(0, 2)}</span>
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-white font-medium text-sm">{inbox.label}</span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${inbox.status === "active" ? "bg-green-500/15 text-green-400" : inbox.status === "error" ? "bg-red-500/15 text-red-400" : "bg-white/10 text-white/40"}`}>
                      {inbox.status}
                    </span>
                    {inbox.warmup_enabled && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/15 text-amber-400">
                        Warmup {inbox.warmup_current_daily}/{inbox.warmup_target_daily}/day
                      </span>
                    )}
                  </div>
                  <div className="text-white/40 text-xs mt-0.5">{inbox.email_address} · Limit: {inbox.daily_send_limit}/day · Window: {inbox.send_window_start}–{inbox.send_window_end} {inbox.timezone}</div>
                  {inbox.last_error && <div className="text-red-400 text-xs mt-1 truncate">⚠ {inbox.last_error}</div>}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  {/* OAuth connect button — shown when inbox lacks OAuth tokens */}
                  {!inbox.has_oauth && inbox.provider === "outlook" && (
                    <a
                      href={`/api/outreach/inboxes/oauth/microsoft?label=${encodeURIComponent(inbox.label)}&email=${encodeURIComponent(inbox.email_address)}`}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium bg-blue-500/15 hover:bg-blue-500/25 text-blue-400 border border-blue-500/30 transition-colors"
                      title="Connect Microsoft OAuth to enable reply detection"
                    >
                      🔗 Connect OAuth
                    </a>
                  )}
                  {!inbox.has_oauth && inbox.provider === "gmail" && (
                    <a
                      href={`/api/outreach/inboxes/oauth/google?label=${encodeURIComponent(inbox.label)}&inbox_id=${inbox.id}`}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium bg-red-500/15 hover:bg-red-500/25 text-red-400 border border-red-500/30 transition-colors"
                      title="Connect Google OAuth to enable reply detection"
                    >
                      🔗 Connect OAuth
                    </a>
                  )}
                  {inbox.has_oauth && (
                    <span className="px-2.5 py-1 rounded-lg text-[10px] font-semibold bg-green-500/10 text-green-400 border border-green-500/20">
                      ✓ OAuth
                    </span>
                  )}
                  <button
                    onClick={() => toggleStatus(inbox)}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium bg-white/6 hover:bg-white/10 text-white/60 hover:text-white transition-colors"
                  >
                    {inbox.status === "active" ? "Pause" : "Resume"}
                  </button>
                  <button
                    onClick={() => handleDelete(inbox.id, inbox.label)}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium bg-red-500/10 hover:bg-red-500/20 text-red-400 transition-colors"
                  >
                    Remove
                  </button>
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

      {/* Import CSV modal */}
      {showImport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-[#1a1a1a] border border-white/10 rounded-2xl w-full max-w-lg shadow-2xl">

            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/8">
              <h2 className="text-white font-semibold">Import Inboxes via CSV</h2>
              <button onClick={() => setShowImport(false)} className="text-white/40 hover:text-white transition-colors">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-6 space-y-5">
              {/* Info */}
              <div className="bg-blue-500/8 border border-blue-500/20 rounded-xl p-4 space-y-1.5">
                <p className="text-blue-300 text-xs font-semibold">Supports Gmail, Outlook, and custom SMTP</p>
                <p className="text-white/40 text-xs">Gmail → use App Passwords with smtp.gmail.com · Outlook → smtp-mail.outlook.com · Microsoft 365 → smtp.office365.com</p>
                <p className="text-white/40 text-xs">Each inbox is verified before saving. Provider is auto-detected from smtp_host.</p>
              </div>

              {/* Template download */}
              <button onClick={downloadTemplate} className="text-blue-400 hover:text-blue-300 text-xs underline transition-colors">
                Download CSV template (with examples)
              </button>

              {/* File input */}
              <div>
                <label className="block text-xs font-semibold text-white/50 uppercase tracking-wider mb-2">CSV File</label>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".csv,text/csv"
                  onChange={(e) => setImportFile(e.target.files?.[0] ?? null)}
                  className="w-full text-sm text-white/60 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-white/10 file:text-white/70 file:text-xs file:font-semibold hover:file:bg-white/15 cursor-pointer"
                />
              </div>

              {/* Import button */}
              <button
                onClick={handleImport}
                disabled={!importFile || importing}
                className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold text-sm rounded-xl transition-colors flex items-center justify-center gap-2"
              >
                {importing ? (
                  <>
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                    </svg>
                    Verifying & importing…
                  </>
                ) : "Import Inboxes"}
              </button>

              {/* Results */}
              {importResult && (
                <div className="space-y-3">
                  <div className="flex items-center gap-4 text-sm">
                    <span className="text-green-400 font-semibold">{importResult.imported} imported</span>
                    {importResult.skipped_duplicate > 0 && <span className="text-white/40">{importResult.skipped_duplicate} duplicate{importResult.skipped_duplicate !== 1 ? "s" : ""} skipped</span>}
                    {importResult.failed_verification > 0 && <span className="text-amber-400">{importResult.failed_verification} failed verification</span>}
                  </div>

                  {importResult.errors.length > 0 && (
                    <div className="bg-red-500/8 border border-red-500/20 rounded-xl p-3 max-h-48 overflow-y-auto space-y-1">
                      <p className="text-red-400 text-xs font-semibold mb-1.5">{importResult.errors.length} error{importResult.errors.length !== 1 ? "s" : ""}:</p>
                      {importResult.errors.map((e, i) => (
                        <div key={i} className="text-red-300/70 text-xs">
                          {e.row > 0 ? `Row ${e.row}` : "Batch"} · <span className="text-red-300/50">{e.email}</span> — {e.message}
                        </div>
                      ))}
                    </div>
                  )}

                  <button onClick={() => setShowImport(false)} className="w-full py-2 bg-white/8 hover:bg-white/12 text-white/70 text-sm font-medium rounded-xl transition-colors">
                    Done
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
