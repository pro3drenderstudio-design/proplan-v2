"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createSmtpInbox } from "@/lib/outreach/api";

type Provider = "gmail" | "outlook" | "smtp";

export default function NewInboxPage() {
  const router = useRouter();
  const [provider, setProvider] = useState<Provider>("gmail");
  const [label, setLabel] = useState("");
  const [smtp, setSmtp] = useState({ host: "", port: "587", user: "", pass: "", imap_host: "", imap_port: "993" });
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState<string | null>(null);

  async function handleOAuth() {
    if (!label.trim()) { setError("Give this inbox a label first"); return; }
    const path = provider === "gmail"
      ? `/api/outreach/inboxes/oauth/google?label=${encodeURIComponent(label)}`
      : `/api/outreach/inboxes/oauth/microsoft?label=${encodeURIComponent(label)}`;
    window.location.href = path;
  }

  async function handleSmtp(e: React.FormEvent) {
    e.preventDefault();
    if (!label || !smtp.host || !smtp.user || !smtp.pass) { setError("All SMTP fields are required"); return; }
    setSaving(true); setError(null);
    const result = await createSmtpInbox({ label, provider: "smtp", email_address: smtp.user, smtp_host: smtp.host, smtp_port: parseInt(smtp.port), smtp_user: smtp.user, smtp_pass: smtp.pass, imap_host: smtp.imap_host, imap_port: parseInt(smtp.imap_port) });
    if (result.error) { setError(result.error); setSaving(false); return; }
    router.push("/admin/outreach/inboxes");
  }

  return (
    <div className="p-6 max-w-xl mx-auto">
      <h1 className="text-xl font-bold text-white mb-1">Add Inbox</h1>
      <p className="text-white/40 text-sm mb-8">Connect an email account to use for cold outreach</p>

      {/* Label */}
      <div className="mb-6">
        <label className="block text-xs font-semibold text-white/50 uppercase tracking-wider mb-2">Inbox Label</label>
        <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. Sales Inbox 1" className="w-full bg-white/6 border border-white/10 rounded-xl px-4 py-3 text-white text-sm placeholder:text-white/25 focus:outline-none focus:border-blue-500/50" />
      </div>

      {/* Provider selector */}
      <div className="mb-8">
        <label className="block text-xs font-semibold text-white/50 uppercase tracking-wider mb-2">Provider</label>
        <div className="grid grid-cols-3 gap-3">
          {(["gmail", "outlook", "smtp"] as Provider[]).map((p) => (
            <button
              key={p}
              onClick={() => setProvider(p)}
              className={`py-3 rounded-xl border text-sm font-semibold transition-all ${provider === p ? "bg-blue-600/20 border-blue-500/50 text-blue-300" : "bg-white/4 border-white/8 text-white/40 hover:text-white/70"}`}
            >
              {p === "gmail" ? "Google Gmail" : p === "outlook" ? "Microsoft Outlook" : "SMTP / Custom"}
            </button>
          ))}
        </div>
      </div>

      {error && <div className="mb-4 px-4 py-3 bg-red-500/15 border border-red-500/30 rounded-xl text-red-400 text-sm">{error}</div>}

      {/* Gmail / Outlook OAuth */}
      {(provider === "gmail" || provider === "outlook") && (
        <div className="bg-white/4 border border-white/8 rounded-xl p-6 text-center">
          <div className="text-white/60 text-sm mb-6">
            {provider === "gmail"
              ? "You'll be redirected to Google to authorize access. Make sure to use a Google Workspace account for higher sending limits (2,000/day)."
              : "You'll be redirected to Microsoft to authorize access. Office 365 accounts support up to 10,000 emails/day."}
          </div>
          <button
            onClick={handleOAuth}
            className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-semibold text-sm transition-colors"
          >
            Connect with {provider === "gmail" ? "Google" : "Microsoft"}
          </button>
        </div>
      )}

      {/* SMTP form */}
      {provider === "smtp" && (
        <form onSubmit={handleSmtp} className="space-y-4">
          {[
            { label: "SMTP Host", key: "host",      placeholder: "smtp.yourprovider.com" },
            { label: "SMTP Port", key: "port",      placeholder: "587" },
            { label: "Username",  key: "user",      placeholder: "you@yourdomain.com" },
            { label: "Password",  key: "pass",      placeholder: "App password or SMTP password", type: "password" },
            { label: "IMAP Host (for reply detection)", key: "imap_host", placeholder: "imap.yourprovider.com" },
            { label: "IMAP Port", key: "imap_port", placeholder: "993" },
          ].map(({ label, key, placeholder, type }) => (
            <div key={key}>
              <label className="block text-xs font-semibold text-white/50 uppercase tracking-wider mb-1.5">{label}</label>
              <input
                type={type ?? "text"}
                value={smtp[key as keyof typeof smtp]}
                onChange={(e) => setSmtp((s) => ({ ...s, [key]: e.target.value }))}
                placeholder={placeholder}
                className="w-full bg-white/6 border border-white/10 rounded-xl px-4 py-3 text-white text-sm placeholder:text-white/25 focus:outline-none focus:border-blue-500/50"
              />
            </div>
          ))}
          <button type="submit" disabled={saving} className="w-full py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-xl font-semibold text-sm transition-colors mt-2">
            {saving ? "Verifying & saving…" : "Save SMTP Inbox"}
          </button>
        </form>
      )}
    </div>
  );
}
