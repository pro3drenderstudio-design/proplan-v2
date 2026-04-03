"use client";

import { useState } from "react";

export default function AdminSettingsPage() {
  const [saved,    setSaved]    = useState(false);
  const [activeTab, setActiveTab] = useState<"general" | "quotes" | "notifications" | "integrations">("general");

  function handleSave() {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  const inputClass = "w-full bg-[#111] border border-white/12 rounded-lg px-3 py-2.5 text-sm text-white placeholder-white/20 outline-none focus:border-blue-500/60 transition-colors";
  const labelClass = "block text-[9px] font-bold uppercase tracking-widest text-white/30 mb-1.5";

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="px-6 py-4 border-b border-white/8 flex-shrink-0">
        <h1 className="text-base font-bold text-white">Platform Settings</h1>
        <p className="text-xs text-white/35 mt-0.5">Configure global platform behavior, quote branding, and integrations.</p>
      </div>

      {/* Tab bar */}
      <div className="flex items-center gap-0 px-6 border-b border-white/8 flex-shrink-0">
        {(["general", "quotes", "notifications", "integrations"] as const).map(t => (
          <button key={t} onClick={() => setActiveTab(t)}
            className={`px-4 py-3 text-xs font-medium border-b-2 transition-colors capitalize ${
              activeTab === t ? "border-blue-500 text-blue-400" : "border-transparent text-white/40 hover:text-white"
            }`}>
            {t}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-2xl space-y-5">

          {/* ── GENERAL ── */}
          {activeTab === "general" && (
            <>
              <section className="bg-[#1a1a1a] border border-white/8 rounded-xl p-5 space-y-4">
                <h2 className="text-sm font-bold text-white">Platform Identity</h2>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={labelClass}>Platform Name</label>
                    <input defaultValue="ProPlan Studio" className={inputClass} />
                  </div>
                  <div>
                    <label className={labelClass}>Support Email</label>
                    <input defaultValue="support@proplanstudio.com" className={inputClass} />
                  </div>
                </div>
                <div>
                  <label className={labelClass}>Platform URL</label>
                  <input defaultValue="https://proplanstudio.com" className={inputClass} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={labelClass}>Default Time Zone</label>
                    <select className={inputClass} defaultValue="America/Chicago">
                      <option value="America/New_York">Eastern (ET)</option>
                      <option value="America/Chicago">Central (CT)</option>
                      <option value="America/Denver">Mountain (MT)</option>
                      <option value="America/Los_Angeles">Pacific (PT)</option>
                    </select>
                  </div>
                  <div>
                    <label className={labelClass}>Default Currency</label>
                    <select className={inputClass} defaultValue="USD">
                      <option value="USD">USD — US Dollar</option>
                      <option value="CAD">CAD — Canadian Dollar</option>
                      <option value="GBP">GBP — British Pound</option>
                    </select>
                  </div>
                </div>
              </section>

              <section className="bg-[#1a1a1a] border border-white/8 rounded-xl p-5 space-y-4">
                <h2 className="text-sm font-bold text-white">Default Builder Plan Limits</h2>
                <div className="grid grid-cols-3 gap-4">
                  {[
                    { label: "Starter — Max Projects",  defaultValue: "5" },
                    { label: "Pro — Max Projects",       defaultValue: "25" },
                    { label: "Enterprise — Max Projects",defaultValue: "100" },
                  ].map(f => (
                    <div key={f.label}>
                      <label className={labelClass}>{f.label}</label>
                      <input type="number" defaultValue={f.defaultValue} className={inputClass} />
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-3 gap-4">
                  {[
                    { label: "Starter — Monthly Quotes",  defaultValue: "25" },
                    { label: "Pro — Monthly Quotes",       defaultValue: "100" },
                    { label: "Enterprise — Monthly Quotes",defaultValue: "500" },
                  ].map(f => (
                    <div key={f.label}>
                      <label className={labelClass}>{f.label}</label>
                      <input type="number" defaultValue={f.defaultValue} className={inputClass} />
                    </div>
                  ))}
                </div>
              </section>

              <section className="bg-[#1a1a1a] border border-white/8 rounded-xl p-5 space-y-3">
                <h2 className="text-sm font-bold text-white">Security</h2>
                {[
                  { label: "Require 2FA for admin accounts", desc: "All admin team members must enable two-factor authentication" },
                  { label: "Auto-expire invite links after 7 days", desc: "Invited users must accept within one week" },
                  { label: "Lock accounts after 10 failed logins", desc: "Automatically suspend accounts after repeated failures" },
                ].map((item, i) => (
                  <label key={i} className="flex items-center justify-between cursor-pointer">
                    <div>
                      <p className="text-xs font-medium text-white/70">{item.label}</p>
                      <p className="text-[10px] text-white/30">{item.desc}</p>
                    </div>
                    <div className="relative ml-3 flex-shrink-0">
                      <input type="checkbox" defaultChecked={i < 2} className="sr-only peer" />
                      <div className="w-9 h-5 bg-white/10 peer-checked:bg-blue-600 rounded-full transition-colors" />
                      <div className="absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform peer-checked:translate-x-4" />
                    </div>
                  </label>
                ))}
              </section>
            </>
          )}

          {/* ── QUOTES ── */}
          {activeTab === "quotes" && (
            <>
              <section className="bg-[#1a1a1a] border border-white/8 rounded-xl p-5 space-y-4">
                <h2 className="text-sm font-bold text-white">Quote Defaults</h2>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={labelClass}>Quote Expiry (days)</label>
                    <input type="number" defaultValue="30" className={inputClass} />
                  </div>
                  <div>
                    <label className={labelClass}>Quote ID Prefix</label>
                    <input defaultValue="QT" className={inputClass} />
                  </div>
                </div>
                <div>
                  <label className={labelClass}>Quote Footer Disclaimer</label>
                  <textarea defaultValue="This quote is an estimate based on your selected configuration. Final pricing may vary. Contact your builder for a formal proposal." rows={3} className={`${inputClass} resize-none`} />
                </div>
              </section>

              <section className="bg-[#1a1a1a] border border-white/8 rounded-xl p-5 space-y-4">
                <h2 className="text-sm font-bold text-white">PDF Branding</h2>
                <p className="text-xs text-white/40 -mt-2">These defaults apply when a builder has no logo configured.</p>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={labelClass}>Default Logo URL</label>
                    <input placeholder="https://..." className={inputClass} />
                  </div>
                  <div>
                    <label className={labelClass}>Default Accent Color</label>
                    <div className="flex items-center gap-2">
                      <input type="color" defaultValue="#3B82F6"
                        className="w-10 h-10 rounded-lg border border-white/12 bg-transparent cursor-pointer p-1" />
                      <input defaultValue="#3B82F6" className={inputClass} />
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={labelClass}>From Email Name</label>
                    <input defaultValue="ProPlan Studio" className={inputClass} />
                  </div>
                  <div>
                    <label className={labelClass}>From Email Address</label>
                    <input defaultValue="no-reply@proplanstudio.com" className={inputClass} />
                  </div>
                </div>
              </section>

              <section className="bg-[#1a1a1a] border border-white/8 rounded-xl p-5 space-y-3">
                <h2 className="text-sm font-bold text-white">Quote Behaviour</h2>
                {[
                  { label: "Generate AI render before quote form", desc: "Uses credits to create a photorealistic render", checked: true },
                  { label: "Auto-email quote PDF to client",       desc: "Sends PDF to lead email automatically on submission", checked: true },
                  { label: "Save lead for every quote submitted",  desc: "Always create a lead record in the CRM", checked: true },
                  { label: "Allow quote without phone number",     desc: "Phone field is optional in the quote form", checked: true },
                ].map((item, i) => (
                  <label key={i} className="flex items-center justify-between cursor-pointer">
                    <div>
                      <p className="text-xs font-medium text-white/70">{item.label}</p>
                      <p className="text-[10px] text-white/30">{item.desc}</p>
                    </div>
                    <div className="relative ml-3 flex-shrink-0">
                      <input type="checkbox" defaultChecked={item.checked} className="sr-only peer" />
                      <div className="w-9 h-5 bg-white/10 peer-checked:bg-blue-600 rounded-full transition-colors" />
                      <div className="absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform peer-checked:translate-x-4" />
                    </div>
                  </label>
                ))}
              </section>
            </>
          )}

          {/* ── NOTIFICATIONS ── */}
          {activeTab === "notifications" && (
            <section className="bg-[#1a1a1a] border border-white/8 rounded-xl p-5 space-y-4">
              <h2 className="text-sm font-bold text-white">Email Notifications</h2>
              <div className="space-y-3">
                {[
                  { label: "New builder registration",      desc: "When a builder signs up for the platform" },
                  { label: "New project job created",       desc: "When a project enters the production queue" },
                  { label: "Project moves to Needs Mapping",desc: "Trigger when status changes to in_review" },
                  { label: "Quote submitted by end client", desc: "Every time a lead submits a quote form" },
                  { label: "Team member invite accepted",   desc: "When an invited team member sets their password" },
                  { label: "Weekly analytics digest",       desc: "Summary email sent every Monday morning" },
                ].map((item, i) => (
                  <label key={i} className="flex items-center justify-between cursor-pointer">
                    <div>
                      <p className="text-xs font-medium text-white/70">{item.label}</p>
                      <p className="text-[10px] text-white/30">{item.desc}</p>
                    </div>
                    <div className="relative ml-3 flex-shrink-0">
                      <input type="checkbox" defaultChecked={i < 4} className="sr-only peer" />
                      <div className="w-9 h-5 bg-white/10 peer-checked:bg-blue-600 rounded-full transition-colors" />
                      <div className="absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform peer-checked:translate-x-4" />
                    </div>
                  </label>
                ))}
              </div>

              <div className="pt-2 border-t border-white/8">
                <label className={labelClass}>Notification Recipient Email</label>
                <input defaultValue="admin@proplanstudio.com" className={inputClass} />
                <p className="text-[10px] text-white/25 mt-1">All admin notifications are sent to this address.</p>
              </div>
            </section>
          )}

          {/* ── INTEGRATIONS ── */}
          {activeTab === "integrations" && (
            <>
              {[
                {
                  name: "Resend (Email)",
                  icon: "✉️",
                  desc: "Transactional emails for quote delivery and invites.",
                  key: "RESEND_API_KEY",
                  connected: true,
                },
                {
                  name: "Sketchfab",
                  icon: "🗺",
                  desc: "3D model embedding and node mapping.",
                  key: "SKETCHFAB_API_KEY",
                  connected: false,
                },
                {
                  name: "Stability AI / FAL",
                  icon: "🎨",
                  desc: "AI render generation for quote previews.",
                  key: "FAL_KEY",
                  connected: true,
                },
              ].map(integration => (
                <div key={integration.name} className="bg-[#1a1a1a] border border-white/8 rounded-xl p-5">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <span className="text-xl">{integration.icon}</span>
                      <div>
                        <p className="text-sm font-bold text-white">{integration.name}</p>
                        <p className="text-xs text-white/40">{integration.desc}</p>
                      </div>
                    </div>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      integration.connected ? "text-green-400 bg-green-400/10" : "text-white/30 bg-white/5"
                    }`}>
                      {integration.connected ? "Connected" : "Not Connected"}
                    </span>
                  </div>
                  <div>
                    <label className={labelClass}>{integration.key}</label>
                    <input
                      type="password"
                      defaultValue={integration.connected ? "••••••••••••••••" : ""}
                      placeholder={`Enter ${integration.key}`}
                      className={inputClass}
                    />
                  </div>
                </div>
              ))}
            </>
          )}

          <div className="flex items-center gap-3 pb-6">
            <button onClick={handleSave}
              className="px-5 py-2.5 bg-blue-600 text-sm text-white font-medium rounded-lg hover:bg-blue-500 transition-colors">
              {saved ? "Saved!" : "Save Changes"}
            </button>
            <button className="px-5 py-2.5 border border-white/12 text-sm text-white/50 font-medium rounded-lg hover:text-white transition-colors">
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
