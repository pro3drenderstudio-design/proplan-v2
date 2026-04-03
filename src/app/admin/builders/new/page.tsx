"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createBuilder } from "@/lib/admin-api";

export default function AddBuilderPage() {
  const router = useRouter();
  const [saving,       setSaving]       = useState(false);
  const [error,        setError]        = useState<string | null>(null);
  const [logoPreview,  setLogoPreview]  = useState<string | null>(null);
  const [logoUploading, setLogoUploading] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    company_name:          "",
    company_slug:          "",
    website_url:           "",
    logo_url:              "",
    accent_color:          "#3B82F6",
    primary_contact_name:  "",
    contact_email:         "",
    phone:                 "",
    tax_id:                "",
    ein:                   "",
    plan_tier:             "starter" as "starter" | "pro" | "enterprise",
    billing_cycle:         "monthly" as "monthly" | "annually",
    billing_address:       "",
    city:                  "",
    state:                 "",
    zip:                   "",
    location:              "",
    notes:                 "",
    // initial project
    initial_project_name:  "",
    project_manager_email: "",
  });

  function set(k: keyof typeof form, v: string) {
    setForm(prev => {
      const next = { ...prev, [k]: v };
      // Auto-generate slug from company name
      if (k === "company_name") {
        next.company_slug = v.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
        if (!prev.location && !next.location) {
          next.location = "";
        }
      }
      return next;
    });
  }

  async function handleLogoUpload(file: File) {
    setLogoUploading(true);
    setLogoPreview(URL.createObjectURL(file));
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch("/api/builders/logo", { method: "POST", body: fd });
    if (res.ok) {
      const { url } = await res.json() as { url: string };
      set("logo_url", url);
    } else {
      setError("Logo upload failed. Make sure the 'builder-logos' storage bucket exists in Supabase.");
      setLogoPreview(null);
    }
    setLogoUploading(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.company_name || !form.company_slug) {
      setError("Company name and slug are required.");
      return;
    }
    setSaving(true);
    setError(null);
    const result = await createBuilder({
      company_name:            form.company_name,
      company_slug:            form.company_slug,
      website_url:             form.website_url || null,
      logo_url:                form.logo_url || null,
      accent_color:            form.accent_color || "#3B82F6",
      primary_contact_name:    form.primary_contact_name || null,
      contact_email:           form.contact_email || null,
      phone:                   form.phone || null,
      tax_id:                  form.tax_id || null,
      ein:                     form.ein || null,
      plan_tier:               form.plan_tier,
      billing_cycle:           form.billing_cycle,
      billing_address:         form.billing_address || null,
      city:                    form.city || null,
      state:                   form.state || null,
      zip:                     form.zip || null,
      location:                form.location || null,
      notes:                   form.notes || null,
      status:                  "active",
      billing_email:           form.contact_email || null,
      vat_tax_id:              null,
      payment_method_last4:    null,
      payment_method_type:     null,
      payment_method_expiry:   null,
      seats_included:          form.plan_tier === "enterprise" ? 50 : form.plan_tier === "pro" ? 25 : 10,
      seats_used:              0,
      rendering_credits:       form.plan_tier === "enterprise" ? 5000 : 1250,
      rendering_credits_total: form.plan_tier === "enterprise" ? 5000 : 2500,
      max_projects:            form.plan_tier === "enterprise" ? 100 : form.plan_tier === "pro" ? 25 : 5,
      max_monthly_quotes:      form.plan_tier === "enterprise" ? 500 : form.plan_tier === "pro" ? 100 : 25,
      max_storage_gb:          form.plan_tier === "enterprise" ? 500 : 50,
      active_projects_count:   0,
      monthly_quotes_count:    0,
      storage_used_gb:         0,
      client_since:            new Date().toISOString(),
    });

    setSaving(false);
    if (!result) {
      setError("Failed to create builder. Make sure the builders table migration has been run.");
      return;
    }
    router.push(`/admin/builders/${result.id}`);
  }

  const inputClass = "w-full bg-[#111] border border-white/12 rounded-lg px-3 py-2.5 text-sm text-white placeholder-white/20 outline-none focus:border-blue-500/60 transition-colors";
  const labelClass = "block text-[10px] font-bold uppercase tracking-widest text-white/35 mb-1.5";

  return (
    <div className="flex flex-col h-full overflow-hidden">

      {/* Header */}
      <div className="px-6 py-4 border-b border-white/8 flex-shrink-0 flex items-center gap-3">
        <Link href="/admin/builders" className="text-white/35 hover:text-white transition-colors">
          <BackIcon className="w-4 h-4" />
        </Link>
        <div>
          <h1 className="text-base font-bold text-white">Add New Builder Client</h1>
          <p className="text-xs text-white/35 mt-0.5">Onboard a new builder account to the platform.</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <form onSubmit={handleSubmit} className="max-w-3xl space-y-6">

          {error && (
            <div className="bg-red-500/10 border border-red-500/25 rounded-xl px-4 py-3 text-sm text-red-400">
              {error}
            </div>
          )}

          {/* Company Information */}
          <section className="bg-[#1a1a1a] border border-white/8 rounded-xl p-5 space-y-4">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-blue-400">🏢</span>
              <h2 className="text-sm font-bold text-white">Company Information</h2>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Company Name *</label>
                <input
                  value={form.company_name}
                  onChange={e => set("company_name", e.target.value)}
                  placeholder="e.g. Acme Homes"
                  required
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Website URL</label>
                <input
                  value={form.website_url}
                  onChange={e => set("website_url", e.target.value)}
                  placeholder="https://www.acmehomes.com"
                  className={inputClass}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Company Logo</label>
                <input
                  ref={logoInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={e => {
                    const file = e.target.files?.[0];
                    if (file) handleLogoUpload(file);
                  }}
                />
                <div
                  onClick={() => !logoUploading && logoInputRef.current?.click()}
                  onDragOver={e => e.preventDefault()}
                  onDrop={e => {
                    e.preventDefault();
                    const file = e.dataTransfer.files[0];
                    if (file?.type.startsWith("image/")) handleLogoUpload(file);
                  }}
                  className="relative flex flex-col items-center justify-center gap-2 border border-dashed border-white/15 rounded-lg h-20 cursor-pointer hover:border-blue-500/50 hover:bg-blue-500/5 transition-colors"
                >
                  {logoUploading ? (
                    <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                  ) : logoPreview ? (
                    <>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={logoPreview} alt="Logo preview" className="h-10 max-w-full object-contain" />
                      <span className="text-[10px] text-white/30">Click to replace</span>
                    </>
                  ) : (
                    <>
                      <UploadIcon className="w-5 h-5 text-white/25" />
                      <span className="text-[10px] text-white/40">Click or drag to upload</span>
                      <span className="text-[9px] text-white/20">PNG, SVG, WEBP recommended</span>
                    </>
                  )}
                </div>
                <p className="text-[10px] text-white/25 mt-1">Shown on quotes, PDFs, and the configurator.</p>
              </div>
              <div>
                <label className={labelClass}>Brand Accent Color</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={form.accent_color}
                    onChange={e => set("accent_color", e.target.value)}
                    className="w-10 h-10 rounded-lg border border-white/12 bg-transparent cursor-pointer p-1 flex-shrink-0"
                  />
                  <input
                    value={form.accent_color}
                    onChange={e => set("accent_color", e.target.value)}
                    placeholder="#3B82F6"
                    className={`${inputClass} font-mono text-xs`}
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Primary Contact Person *</label>
                <input
                  value={form.primary_contact_name}
                  onChange={e => set("primary_contact_name", e.target.value)}
                  placeholder="Full Name"
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Contact Email</label>
                <input
                  type="email"
                  value={form.contact_email}
                  onChange={e => set("contact_email", e.target.value)}
                  placeholder="admin@acmehomes.com"
                  className={inputClass}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Phone Number</label>
                <input
                  value={form.phone}
                  onChange={e => set("phone", e.target.value)}
                  placeholder="(555) 123-4567"
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Tax ID / EIN</label>
                <input
                  value={form.ein}
                  onChange={e => set("ein", e.target.value)}
                  placeholder="XX-XXXXXXX"
                  className={inputClass}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Company Slug (auto-generated)</label>
                <input
                  value={form.company_slug}
                  onChange={e => set("company_slug", e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
                  placeholder="acme-homes"
                  className={`${inputClass} font-mono text-xs`}
                />
              </div>
              <div>
                <label className={labelClass}>Location</label>
                <input
                  value={form.location}
                  onChange={e => set("location", e.target.value)}
                  placeholder="Austin, TX"
                  className={inputClass}
                />
              </div>
            </div>
          </section>

          {/* Billing Information */}
          <section className="bg-[#1a1a1a] border border-white/8 rounded-xl p-5 space-y-4">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-amber-400">💳</span>
              <h2 className="text-sm font-bold text-white">Billing Information</h2>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Plan Tier *</label>
                <select
                  value={form.plan_tier}
                  onChange={e => set("plan_tier", e.target.value)}
                  className={inputClass}
                >
                  <option value="">Select a tier...</option>
                  <option value="starter">Starter — $99/mo</option>
                  <option value="pro">Pro — $299/mo</option>
                  <option value="enterprise">Enterprise — $499/mo</option>
                </select>
              </div>
              <div>
                <label className={labelClass}>Billing Cycle *</label>
                <div className="flex items-center gap-4 pt-2">
                  {["monthly", "annually"].map(cycle => (
                    <label key={cycle} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="billing_cycle"
                        value={cycle}
                        checked={form.billing_cycle === cycle}
                        onChange={e => set("billing_cycle", e.target.value)}
                        className="accent-blue-500"
                      />
                      <span className="text-sm text-white/70 capitalize">{cycle}</span>
                      {cycle === "annually" && (
                        <span className="text-[10px] font-bold text-green-400 bg-green-400/10 px-1.5 py-0.5 rounded">Save 20%</span>
                      )}
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <div>
              <label className={labelClass}>Billing Address</label>
              <input
                value={form.billing_address}
                onChange={e => set("billing_address", e.target.value)}
                placeholder="Street Address"
                className={inputClass}
              />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <input value={form.city}  onChange={e => set("city", e.target.value)}  placeholder="City"            className={inputClass} />
              <input value={form.state} onChange={e => set("state", e.target.value)} placeholder="State / Province" className={inputClass} />
              <input value={form.zip}   onChange={e => set("zip", e.target.value)}   placeholder="Zip / Postal Code" className={inputClass} />
            </div>
          </section>

          {/* Initial Project Details */}
          <section className="bg-[#1a1a1a] border border-white/8 rounded-xl p-5 space-y-4">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-violet-400">🚀</span>
              <h2 className="text-sm font-bold text-white">Initial Project Details</h2>
              <span className="text-[10px] text-white/25 font-medium uppercase tracking-wide">Optional</span>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Initial Project Name</label>
                <input
                  value={form.initial_project_name}
                  onChange={e => set("initial_project_name", e.target.value)}
                  placeholder="e.g. Whispering Pines Phase 1"
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Project Manager Email</label>
                <input
                  type="email"
                  value={form.project_manager_email}
                  onChange={e => set("project_manager_email", e.target.value)}
                  placeholder="pm@acmehomes.com"
                  className={inputClass}
                />
              </div>
            </div>
          </section>

          {/* Internal Admin Notes */}
          <section className="bg-[#1a1a1a] border border-white/8 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-white/40">📋</span>
              <h2 className="text-sm font-bold text-white">Internal Admin Notes</h2>
            </div>
            <textarea
              value={form.notes}
              onChange={e => set("notes", e.target.value)}
              placeholder="Add any specific context or requirements for this client."
              rows={4}
              className={`${inputClass} resize-none`}
            />
          </section>

          {/* Actions */}
          <div className="flex items-center gap-3 pb-6">
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2.5 bg-blue-600 text-sm text-white font-medium rounded-lg hover:bg-blue-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? "Creating..." : "Create Builder Account"}
            </button>
            <Link
              href="/admin/builders"
              className="px-5 py-2.5 border border-white/12 text-sm text-white/50 font-medium rounded-lg hover:text-white hover:border-white/25 transition-colors"
            >
              Cancel
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}

function BackIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18"/>
    </svg>
  );
}

function UploadIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"/>
    </svg>
  );
}
