"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getAllBuilders } from "@/lib/admin-api";
import { Builder } from "@/types/database";
import { supabase } from "@/lib/supabase";

const HOME_TYPES = [
  { value: "single_family", label: "Single Family" },
  { value: "townhome",      label: "Townhome" },
  { value: "duplex",        label: "Duplex" },
  { value: "condo",         label: "Condo" },
  { value: "custom",        label: "Custom" },
];

export default function NewProjectPage() {
  const router = useRouter();
  const [builders, setBuilders] = useState<Builder[]>([]);
  const [saving,   setSaving]   = useState(false);
  const [error,    setError]    = useState<string | null>(null);

  const [form, setForm] = useState({
    name:          "",
    slug:          "",
    builder_id:    "",
    company_slug:  "",
    home_type:     "single_family",
    beds:          "",
    baths:         "",
    floors:        "1",
    sqft:          "",
    base_price:    "",
    sketchfab_uid: "",
    description:   "",
    status:        "pending_review" as const,
  });

  useEffect(() => {
    getAllBuilders().then(setBuilders);
  }, []);

  function set(k: keyof typeof form, v: string) {
    setForm(prev => {
      const next = { ...prev, [k]: v };
      if (k === "name") {
        next.slug = v.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      }
      if (k === "builder_id") {
        const builder = builders.find(b => b.id === v);
        next.company_slug = builder?.company_slug ?? "";
      }
      return next;
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name || !form.slug) { setError("Project name is required."); return; }
    setSaving(true);
    setError(null);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error: err } = await (supabase.from("projects") as any).insert({
      name:          form.name,
      slug:          form.slug,
      company_slug:  form.company_slug || null,
      home_type:     form.home_type,
      beds:          form.beds ? parseInt(form.beds) : null,
      baths:         form.baths ? parseFloat(form.baths) : null,
      floors:        form.floors ? parseInt(form.floors) : 1,
      sqft:          form.sqft ? parseInt(form.sqft) : null,
      base_price:    form.base_price ? parseFloat(form.base_price) : 0,
      sketchfab_uid: form.sketchfab_uid || "",
      description:   form.description || null,
      status:        form.status,
      camera_defaults: {},
    }).select().single();

    setSaving(false);
    if (err) { setError(err.message); return; }
    router.push(`/admin/requests/${data.id}`);
  }

  const inputClass = "w-full bg-[#111] border border-white/12 rounded-lg px-3 py-2.5 text-sm text-white placeholder-white/20 outline-none focus:border-blue-500/60 transition-colors";
  const labelClass = "block text-[9px] font-bold uppercase tracking-widest text-white/35 mb-1.5";

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="px-6 py-4 border-b border-white/8 flex-shrink-0 flex items-center gap-3">
        <Link href="/admin/requests" className="text-white/35 hover:text-white transition-colors">
          <BackIcon className="w-4 h-4" />
        </Link>
        <div>
          <h1 className="text-base font-bold text-white">New Job</h1>
          <p className="text-xs text-white/35 mt-0.5">Create a new project in the production pipeline.</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <form onSubmit={handleSubmit} className="max-w-2xl space-y-5">
          {error && (
            <div className="bg-red-500/10 border border-red-500/25 rounded-xl px-4 py-3 text-sm text-red-400">{error}</div>
          )}

          {/* Basic Info */}
          <section className="bg-[#1a1a1a] border border-white/8 rounded-xl p-5 space-y-4">
            <h2 className="text-sm font-bold text-white">Project Info</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Project Name *</label>
                <input value={form.name} onChange={e => set("name", e.target.value)} placeholder="e.g. The Magnolia" required className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>URL Slug</label>
                <input value={form.slug} onChange={e => set("slug", e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))} placeholder="the-magnolia" className={`${inputClass} font-mono text-xs`} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Builder Client</label>
                <select value={form.builder_id} onChange={e => set("builder_id", e.target.value)} className={inputClass}>
                  <option value="">Select a builder...</option>
                  {builders.map(b => <option key={b.id} value={b.id}>{b.company_name}</option>)}
                </select>
              </div>
              <div>
                <label className={labelClass}>Home Type</label>
                <select value={form.home_type} onChange={e => set("home_type", e.target.value)} className={inputClass}>
                  {HOME_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
            </div>

            <div>
              <label className={labelClass}>Description</label>
              <textarea value={form.description} onChange={e => set("description", e.target.value)} rows={3} placeholder="Brief description of this home model..." className={`${inputClass} resize-none`} />
            </div>
          </section>

          {/* Specs */}
          <section className="bg-[#1a1a1a] border border-white/8 rounded-xl p-5 space-y-4">
            <h2 className="text-sm font-bold text-white">Specifications</h2>
            <div className="grid grid-cols-4 gap-4">
              <div>
                <label className={labelClass}>Beds</label>
                <input type="number" min="0" value={form.beds} onChange={e => set("beds", e.target.value)} placeholder="4" className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Baths</label>
                <input type="number" min="0" step="0.5" value={form.baths} onChange={e => set("baths", e.target.value)} placeholder="2.5" className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Floors</label>
                <input type="number" min="1" max="5" value={form.floors} onChange={e => set("floors", e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Sqft</label>
                <input type="number" min="0" value={form.sqft} onChange={e => set("sqft", e.target.value)} placeholder="2400" className={inputClass} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Base Price ($)</label>
                <input type="number" min="0" value={form.base_price} onChange={e => set("base_price", e.target.value)} placeholder="350000" className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Initial Status</label>
                <select value={form.status} onChange={e => set("status", e.target.value as typeof form.status)} className={inputClass}>
                  <option value="pending_review">New Request</option>
                  <option value="in_development">In Progress</option>
                  <option value="in_review">Needs Mapping</option>
                </select>
              </div>
            </div>
          </section>

          {/* 3D Model */}
          <section className="bg-[#1a1a1a] border border-white/8 rounded-xl p-5 space-y-4">
            <h2 className="text-sm font-bold text-white">3D Model (Optional)</h2>
            <div>
              <label className={labelClass}>Sketchfab Model UID</label>
              <input value={form.sketchfab_uid} onChange={e => set("sketchfab_uid", e.target.value)} placeholder="e.g. abc123def456..." className={`${inputClass} font-mono text-xs`} />
              <p className="text-[10px] text-white/25 mt-1">Can be added later via Node Bridge.</p>
            </div>
          </section>

          <div className="flex items-center gap-3 pb-6">
            <button type="submit" disabled={saving}
              className="px-5 py-2.5 bg-blue-600 text-sm text-white font-medium rounded-lg hover:bg-blue-500 transition-colors disabled:opacity-50">
              {saving ? "Creating..." : "Create Project"}
            </button>
            <Link href="/admin/requests" className="px-5 py-2.5 border border-white/12 text-sm text-white/50 font-medium rounded-lg hover:text-white transition-colors">
              Cancel
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}

function BackIcon({ className }: { className?: string }) {
  return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18"/></svg>;
}
