"use client";
import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { getInboxes, deleteInbox, updateInbox, importInboxes } from "@/lib/outreach/api";
import type { OutreachInboxSafe, InboxImportResult } from "@/types/outreach";

// ─── CSV column mapping ────────────────────────────────────────────────────────

const INBOX_FIELDS: { key: string; label: string; required: boolean }[] = [
  { key: "email",            label: "Email address",     required: true  },
  { key: "smtp_host",        label: "SMTP host",         required: true  },
  { key: "smtp_user",        label: "SMTP username",     required: true  },
  { key: "smtp_pass",        label: "SMTP password",     required: true  },
  { key: "label",            label: "Label / name",      required: false },
  { key: "smtp_port",        label: "SMTP port",         required: false },
  { key: "imap_host",        label: "IMAP host",         required: false },
  { key: "imap_port",        label: "IMAP port",         required: false },
  { key: "daily_limit",      label: "Daily send limit",  required: false },
  { key: "timezone",         label: "Timezone",          required: false },
  { key: "send_window_start",label: "Send window start", required: false },
  { key: "send_window_end",  label: "Send window end",   required: false },
  { key: "warmup_target",    label: "Warmup target",     required: false },
];

function parseCsvHeaders(text: string): string[] {
  const firstLine = text.split("\n")[0] ?? "";
  return firstLine.split(",").map((h) => h.trim().replace(/^"|"$/g, ""));
}

function autoMap(headers: string[]): Record<string, string> {
  const normalized = headers.map((h) => h.toLowerCase().replace(/[\s\-]/g, "_"));
  const mapping: Record<string, string> = {};
  for (const field of INBOX_FIELDS) {
    const aliases: Record<string, string[]> = {
      email:             ["email", "email_address", "from_email"],
      smtp_host:         ["smtp_host", "smtp_server", "mail_server"],
      smtp_user:         ["smtp_user", "smtp_username", "username", "user"],
      smtp_pass:         ["smtp_pass", "smtp_password", "password", "pass", "app_password"],
      label:             ["label", "name", "inbox_name"],
      smtp_port:         ["smtp_port", "port"],
      imap_host:         ["imap_host", "imap_server"],
      imap_port:         ["imap_port"],
      daily_limit:       ["daily_limit", "daily_send_limit", "limit"],
      timezone:          ["timezone", "time_zone", "tz"],
      send_window_start: ["send_window_start", "window_start", "start_time"],
      send_window_end:   ["send_window_end",   "window_end",   "end_time"],
      warmup_target:     ["warmup_target", "warmup_target_daily"],
    };
    const candidates = aliases[field.key] ?? [field.key];
    const match = normalized.findIndex((n) => candidates.includes(n));
    if (match !== -1) mapping[field.key] = headers[match];
  }
  return mapping;
}

function remapCsv(text: string, mapping: Record<string, string>): string {
  const lines = text.split("\n").filter(Boolean);
  if (!lines.length) return text;
  const originalHeaders = lines[0].split(",").map((h) => h.trim().replace(/^"|"$/g, ""));
  // Build new header row using our standard keys
  const newHeaders = INBOX_FIELDS.map((f) => f.key);
  const headerLine = newHeaders.join(",");
  const dataLines = lines.slice(1).map((line) => {
    const cells = line.split(",").map((c) => c.trim().replace(/^"|"$/g, ""));
    return newHeaders.map((key) => {
      const srcCol = mapping[key];
      if (!srcCol) return "";
      const idx = originalHeaders.indexOf(srcCol);
      return idx !== -1 ? (cells[idx] ?? "") : "";
    }).join(",");
  });
  return [headerLine, ...dataLines].join("\n");
}

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
  const [csvHeaders, setCsvHeaders]     = useState<string[]>([]);
  const [colMapping, setColMapping]     = useState<Record<string, string>>({});
  const [showMapping, setShowMapping]   = useState(false);
  const [page, setPage]                 = useState(0);

  const PAGE_SIZE = 10;

  // ── Bulk selection ────────────────────────────────────────────────────────
  const [selected, setSelected]         = useState<Set<string>>(new Set());
  const [allSelected, setAllSelected]   = useState(false); // true = every inbox selected
  const [bulkWorking, setBulkWorking]   = useState(false);
  const [showBulkEdit, setShowBulkEdit] = useState(false);
  const [bulkFields, setBulkFields]     = useState({
    first_name: "", last_name: "",
    daily_send_limit: "", send_window_start: "", send_window_end: "",
    timezone: "", status: "" as "" | "active" | "paused",
  });

  const pageInboxes = inboxes.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const allPageSelected = pageInboxes.length > 0 && pageInboxes.every((i) => selected.has(i.id));
  const effectiveCount  = allSelected ? inboxes.length : selected.size;

  function toggleSelect(id: string) {
    setAllSelected(false);
    setSelected((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }
  function toggleSelectAll() {
    setAllSelected(false);
    if (allPageSelected) {
      setSelected((s) => { const n = new Set(s); pageInboxes.forEach((i) => n.delete(i.id)); return n; });
    } else {
      setSelected((s) => { const n = new Set(s); pageInboxes.forEach((i) => n.add(i.id)); return n; });
    }
  }
  function selectAllInboxes() {
    setAllSelected(true);
    setSelected(new Set(inboxes.map((i) => i.id)));
  }
  function clearSelection() {
    setAllSelected(false);
    setSelected(new Set());
  }

  const targetIds = allSelected ? inboxes.map((i) => i.id) : [...selected];

  async function handleBulkDelete() {
    if (!confirm(`Delete ${effectiveCount} inbox${effectiveCount !== 1 ? "es" : ""}? This will stop all campaigns using them.`)) return;
    setBulkWorking(true);
    await Promise.all(targetIds.map((id) => deleteInbox(id)));
    clearSelection();
    setBulkWorking(false);
    load();
    showToast(`Deleted ${effectiveCount} inboxes`);
  }

  async function handleBulkStatusChange(status: "active" | "paused") {
    setBulkWorking(true);
    await Promise.all(targetIds.map((id) => updateInbox(id, { status })));
    clearSelection();
    setBulkWorking(false);
    load();
    showToast(`${effectiveCount} inboxes ${status === "active" ? "resumed" : "paused"}`);
  }

  async function handleBulkEdit() {
    const patch: Record<string, unknown> = {};
    if (bulkFields.first_name)        patch.first_name        = bulkFields.first_name;
    if (bulkFields.last_name)         patch.last_name         = bulkFields.last_name;
    if (bulkFields.daily_send_limit)  patch.daily_send_limit  = parseInt(bulkFields.daily_send_limit);
    if (bulkFields.send_window_start) patch.send_window_start = bulkFields.send_window_start;
    if (bulkFields.send_window_end)   patch.send_window_end   = bulkFields.send_window_end;
    if (bulkFields.timezone)          patch.timezone          = bulkFields.timezone;
    if (bulkFields.status)            patch.status            = bulkFields.status;
    if (!Object.keys(patch).length) { setShowBulkEdit(false); return; }
    setBulkWorking(true);
    await Promise.all(targetIds.map((id) => updateInbox(id, patch)));
    clearSelection();
    setShowBulkEdit(false);
    setBulkFields({ first_name: "", last_name: "", daily_send_limit: "", send_window_start: "", send_window_end: "", timezone: "", status: "" });
    setBulkWorking(false);
    load();
    showToast(`Updated ${effectiveCount} inboxes`);
  }

  const fileRef = useRef<HTMLInputElement>(null);

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

  async function handleFileSelect(file: File | null) {
    setImportFile(file);
    setImportResult(null);
    setShowMapping(false);
    setCsvHeaders([]);
    if (!file) return;
    const text = await file.text();
    const headers = parseCsvHeaders(text);
    setCsvHeaders(headers);
    setColMapping(autoMap(headers));
    setShowMapping(true);
  }

  async function handleImport() {
    if (!importFile) return;
    setImporting(true);
    setImportResult(null);

    let fileToSend = importFile;
    // If mapping is active, remap CSV columns before uploading
    if (showMapping && Object.keys(colMapping).length > 0) {
      const text = await importFile.text();
      const remapped = remapCsv(text, colMapping);
      fileToSend = new File([remapped], importFile.name, { type: "text/csv" });
    }

    const result = await importInboxes(fileToSend);
    setImportResult(result);
    setImporting(false);
    if (result.imported > 0) {
      showToast(`Imported ${result.imported} inbox${result.imported !== 1 ? "es" : ""}`);
      load();
    }
    setImportFile(null);
    setShowMapping(false);
    setCsvHeaders([]);
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
            onClick={() => { setShowImport(true); setImportResult(null); setShowMapping(false); setCsvHeaders([]); setImportFile(null); }}
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
        {/* Bulk action bar */}
        {selected.size > 0 && (
          <div className="mb-3 space-y-2">
            <div className="flex items-center gap-2 px-4 py-2.5 bg-blue-600/15 border border-blue-500/30 rounded-xl">
              <span className="text-blue-300 text-xs font-semibold flex-1">
                {effectiveCount} inbox{effectiveCount !== 1 ? "es" : ""} selected
                {!allSelected && inboxes.length > PAGE_SIZE && (
                  <button onClick={selectAllInboxes} className="ml-2 text-blue-400 hover:text-blue-200 underline transition-colors">
                    Select all {inboxes.length}
                  </button>
                )}
              </span>
              <button onClick={() => handleBulkStatusChange("active")} disabled={bulkWorking} className="px-3 py-1.5 bg-green-500/15 hover:bg-green-500/25 text-green-400 text-xs font-semibold rounded-lg border border-green-500/30 transition-colors disabled:opacity-40">Resume</button>
              <button onClick={() => handleBulkStatusChange("paused")} disabled={bulkWorking} className="px-3 py-1.5 bg-white/8 hover:bg-white/12 text-white/60 text-xs font-semibold rounded-lg border border-white/10 transition-colors disabled:opacity-40">Pause</button>
              <button onClick={() => setShowBulkEdit(true)}            disabled={bulkWorking} className="px-3 py-1.5 bg-violet-500/15 hover:bg-violet-500/25 text-violet-400 text-xs font-semibold rounded-lg border border-violet-500/30 transition-colors disabled:opacity-40">Edit settings</button>
              <button onClick={handleBulkDelete}                        disabled={bulkWorking} className="px-3 py-1.5 bg-red-500/15 hover:bg-red-500/25 text-red-400 text-xs font-semibold rounded-lg border border-red-500/30 transition-colors disabled:opacity-40">Delete</button>
              <button onClick={clearSelection} className="text-white/30 hover:text-white/60 text-xs ml-1 transition-colors">✕</button>
            </div>
          </div>
        )}

        {/* Select-all row header */}
        <div className="flex items-center gap-3 px-1 pb-1">
          <input type="checkbox" checked={allPageSelected} onChange={toggleSelectAll}
            className="w-4 h-4 rounded accent-blue-500 cursor-pointer flex-shrink-0" />
          <span className="text-white/30 text-xs">{allPageSelected ? "Deselect all on page" : "Select all on page"}</span>
        </div>

        <div className="space-y-3">
          {pageInboxes.map((inbox) => {
            const color = PROVIDER_COLORS[inbox.provider] ?? "#888";
            const isSelected = selected.has(inbox.id);
            return (
              <div key={inbox.id} onClick={() => toggleSelect(inbox.id)} className={`bg-white/4 border rounded-xl p-4 flex items-center gap-4 cursor-pointer transition-colors ${isSelected ? "border-blue-500/50 bg-blue-500/8" : "border-white/8 hover:border-white/15"}`}>
                {/* Checkbox */}
                <input type="checkbox" checked={isSelected} onChange={() => toggleSelect(inbox.id)}
                  onClick={(e) => e.stopPropagation()}
                  className="w-4 h-4 rounded accent-blue-500 cursor-pointer flex-shrink-0" />
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
                  {(inbox.first_name || inbox.last_name) && (
                    <div className="text-white/55 text-xs">{[inbox.first_name, inbox.last_name].filter(Boolean).join(" ")}</div>
                  )}
                  <div className="text-white/40 text-xs mt-0.5">{inbox.email_address} · Limit: {inbox.daily_send_limit}/day · Window: {inbox.send_window_start}–{inbox.send_window_end} {inbox.timezone}</div>
                  {inbox.last_error && <div className="text-red-400 text-xs mt-1 truncate">⚠ {inbox.last_error}</div>}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
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
                  onChange={(e) => handleFileSelect(e.target.files?.[0] ?? null)}
                  className="w-full text-sm text-white/60 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-white/10 file:text-white/70 file:text-xs file:font-semibold hover:file:bg-white/15 cursor-pointer"
                />
              </div>

              {/* Column mapping */}
              {showMapping && csvHeaders.length > 0 && (
                <div className="space-y-3">
                  <p className="text-xs font-semibold text-white/50 uppercase tracking-wider">Map Columns</p>
                  <div className="bg-white/4 border border-white/8 rounded-xl overflow-hidden divide-y divide-white/5 max-h-64 overflow-y-auto">
                    {INBOX_FIELDS.map((field) => (
                      <div key={field.key} className="flex items-center gap-3 px-3 py-2">
                        <span className={`text-xs w-36 flex-shrink-0 ${field.required ? "text-white/70" : "text-white/35"}`}>
                          {field.label}{field.required && <span className="text-red-400 ml-0.5">*</span>}
                        </span>
                        <select
                          value={colMapping[field.key] ?? ""}
                          onChange={(e) => setColMapping((m) => ({ ...m, [field.key]: e.target.value }))}
                          className="flex-1 bg-white/6 border border-white/10 rounded-lg px-2 py-1 text-xs text-white/70 focus:outline-none focus:border-blue-500/50"
                        >
                          <option value="">— skip —</option>
                          {csvHeaders.map((h) => (
                            <option key={h} value={h}>{h}</option>
                          ))}
                        </select>
                      </div>
                    ))}
                  </div>
                </div>
              )}

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

      {/* Bulk edit modal */}
      {showBulkEdit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-[#1a1a1a] border border-white/10 rounded-2xl w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/8">
              <h2 className="text-white font-semibold">Edit {selected.size} Inbox{selected.size !== 1 ? "es" : ""}</h2>
              <button onClick={() => setShowBulkEdit(false)} className="text-white/40 hover:text-white transition-colors text-lg">✕</button>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-white/40 text-xs">Only filled fields will be updated. Leave blank to keep existing values.</p>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-white/50 uppercase tracking-wider mb-1.5">First name</label>
                  <input
                    type="text" placeholder="e.g. John"
                    value={bulkFields.first_name}
                    onChange={(e) => setBulkFields((f) => ({ ...f, first_name: e.target.value }))}
                    className="w-full bg-white/6 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/20 focus:outline-none focus:border-blue-500/50"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-white/50 uppercase tracking-wider mb-1.5">Last name</label>
                  <input
                    type="text" placeholder="e.g. Smith"
                    value={bulkFields.last_name}
                    onChange={(e) => setBulkFields((f) => ({ ...f, last_name: e.target.value }))}
                    className="w-full bg-white/6 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/20 focus:outline-none focus:border-blue-500/50"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-white/50 uppercase tracking-wider mb-1.5">Daily send limit</label>
                  <input
                    type="number" min="1" max="500"
                    placeholder="e.g. 50"
                    value={bulkFields.daily_send_limit}
                    onChange={(e) => setBulkFields((f) => ({ ...f, daily_send_limit: e.target.value }))}
                    className="w-full bg-white/6 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/20 focus:outline-none focus:border-blue-500/50"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-white/50 uppercase tracking-wider mb-1.5">Status</label>
                  <select
                    value={bulkFields.status}
                    onChange={(e) => setBulkFields((f) => ({ ...f, status: e.target.value as "" | "active" | "paused" }))}
                    className="w-full bg-white/6 border border-white/10 rounded-lg px-3 py-2 text-sm text-white/70 focus:outline-none focus:border-blue-500/50"
                  >
                    <option value="">— no change —</option>
                    <option value="active">Active</option>
                    <option value="paused">Paused</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-white/50 uppercase tracking-wider mb-1.5">Send window start</label>
                  <input
                    type="time"
                    value={bulkFields.send_window_start}
                    onChange={(e) => setBulkFields((f) => ({ ...f, send_window_start: e.target.value }))}
                    className="w-full bg-white/6 border border-white/10 rounded-lg px-3 py-2 text-sm text-white/70 focus:outline-none focus:border-blue-500/50"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-white/50 uppercase tracking-wider mb-1.5">Send window end</label>
                  <input
                    type="time"
                    value={bulkFields.send_window_end}
                    onChange={(e) => setBulkFields((f) => ({ ...f, send_window_end: e.target.value }))}
                    className="w-full bg-white/6 border border-white/10 rounded-lg px-3 py-2 text-sm text-white/70 focus:outline-none focus:border-blue-500/50"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-white/50 uppercase tracking-wider mb-1.5">Timezone</label>
                <input
                  type="text"
                  placeholder="e.g. America/New_York"
                  value={bulkFields.timezone}
                  onChange={(e) => setBulkFields((f) => ({ ...f, timezone: e.target.value }))}
                  className="w-full bg-white/6 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/20 focus:outline-none focus:border-blue-500/50"
                />
              </div>

              <div className="flex gap-3 pt-1">
                <button onClick={() => setShowBulkEdit(false)} className="flex-1 py-2.5 bg-white/6 hover:bg-white/10 text-white/60 text-sm font-semibold rounded-xl transition-colors">
                  Cancel
                </button>
                <button onClick={handleBulkEdit} disabled={bulkWorking} className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-sm font-semibold rounded-xl transition-colors">
                  {bulkWorking ? "Saving…" : "Apply changes"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
