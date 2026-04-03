"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function SignupPage() {
  const router = useRouter();
  const [step,     setStep]     = useState<1 | 2>(1);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState<string | null>(null);
  const [form, setForm] = useState({
    full_name:    "",
    email:        "",
    password:     "",
    confirm:      "",
    company_name: "",
    company_slug: "",
    phone:        "",
    location:     "",
  });

  function set(k: keyof typeof form, v: string) {
    setForm(prev => {
      const next = { ...prev, [k]: v };
      if (k === "company_name") {
        next.company_slug = v.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      }
      return next;
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (step === 1) { setStep(2); return; }

    if (form.password !== form.confirm) { setError("Passwords do not match."); return; }
    if (form.password.length < 8)       { setError("Password must be at least 8 characters."); return; }

    setLoading(true);
    setError(null);

    // Create auth user
    const { data: authData, error: authErr } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: { data: { full_name: form.full_name } },
    });
    if (authErr) { setError(authErr.message); setLoading(false); return; }
    if (!authData.user) { setError("Signup failed — please try again."); setLoading(false); return; }

    // Create builder record
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: builderData } = await (supabase.from("builders") as any).insert({
      company_name:           form.company_name,
      company_slug:           form.company_slug,
      primary_contact_name:   form.full_name,
      contact_email:          form.email,
      phone:                  form.phone || null,
      location:               form.location || null,
      plan_tier:              "starter",
      billing_cycle:          "monthly",
      status:                 "trial",
      accent_color:           "#3B82F6",
      seats_included:         10,
      seats_used:             1,
      rendering_credits:      250,
      rendering_credits_total: 250,
      max_projects:           5,
      max_monthly_quotes:     25,
      max_storage_gb:         10,
      active_projects_count:  0,
      monthly_quotes_count:   0,
      storage_used_gb:        0,
    }).select().single();

    // Create profile
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from("profiles") as any).insert({
      id:         authData.user.id,
      email:      form.email,
      full_name:  form.full_name,
      role:       "builder_admin",
      builder_id: builderData?.id ?? null,
    });

    setLoading(false);
    router.push("/builder/dashboard");
  }

  const inputClass = "w-full bg-white/5 border border-white/12 rounded-xl px-4 py-3 text-sm text-white placeholder-white/20 outline-none focus:border-blue-500/60 transition-colors";

  return (
    <div className="w-full max-w-sm">
      <div className="flex flex-col items-center gap-2 mb-8">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo_light.png" alt="ProPlan Studio" className="h-9 object-contain" />
        <p className="text-[9px] text-white/30 uppercase tracking-widest">Create your account</p>
      </div>

      <div className="bg-[#1a1a1a] border border-white/8 rounded-2xl p-6">
        {/* Step indicator */}
        <div className="flex items-center gap-2 mb-5">
          {[1, 2].map(s => (
            <div key={s} className={`h-1 flex-1 rounded-full transition-colors ${s <= step ? "bg-blue-500" : "bg-white/10"}`} />
          ))}
        </div>
        <h1 className="text-lg font-bold text-white mb-1">
          {step === 1 ? "Company Details" : "Your Account"}
        </h1>
        <p className="text-xs text-white/40 mb-6">
          {step === 1 ? "Tell us about your home building company." : "Set up your login credentials."}
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="bg-red-500/10 border border-red-500/25 rounded-xl px-3 py-2.5 text-xs text-red-400">{error}</div>
          )}

          {step === 1 ? (
            <>
              <div>
                <label className="block text-xs text-white/50 mb-1.5">Company Name *</label>
                <input value={form.company_name} onChange={e => set("company_name", e.target.value)}
                  placeholder="Acme Homes" required className={inputClass} />
              </div>
              <div>
                <label className="block text-xs text-white/50 mb-1.5">Company URL Slug</label>
                <input value={form.company_slug} onChange={e => set("company_slug", e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
                  placeholder="acme-homes" className={`${inputClass} font-mono text-xs`} />
              </div>
              <div>
                <label className="block text-xs text-white/50 mb-1.5">Your Full Name *</label>
                <input value={form.full_name} onChange={e => set("full_name", e.target.value)}
                  placeholder="Jane Smith" required className={inputClass} />
              </div>
              <div>
                <label className="block text-xs text-white/50 mb-1.5">Location</label>
                <input value={form.location} onChange={e => set("location", e.target.value)}
                  placeholder="Austin, TX" className={inputClass} />
              </div>
            </>
          ) : (
            <>
              <div>
                <label className="block text-xs text-white/50 mb-1.5">Work Email *</label>
                <input type="email" value={form.email} onChange={e => set("email", e.target.value)}
                  placeholder="you@acmehomes.com" required autoComplete="email" className={inputClass} />
              </div>
              <div>
                <label className="block text-xs text-white/50 mb-1.5">Password *</label>
                <input type="password" value={form.password} onChange={e => set("password", e.target.value)}
                  placeholder="Min 8 characters" required className={inputClass} />
              </div>
              <div>
                <label className="block text-xs text-white/50 mb-1.5">Confirm Password *</label>
                <input type="password" value={form.confirm} onChange={e => set("confirm", e.target.value)}
                  placeholder="Repeat password" required className={inputClass} />
              </div>
            </>
          )}

          <div className="flex gap-3">
            {step === 2 && (
              <button type="button" onClick={() => setStep(1)}
                className="px-4 py-3 border border-white/12 text-sm text-white/50 rounded-xl hover:text-white transition-colors">
                Back
              </button>
            )}
            <button type="submit" disabled={loading}
              className="flex-1 py-3 bg-blue-600 text-sm text-white font-semibold rounded-xl hover:bg-blue-500 transition-colors disabled:opacity-50">
              {loading ? "Creating..." : step === 1 ? "Continue →" : "Create Account"}
            </button>
          </div>
        </form>

        <div className="mt-5 pt-5 border-t border-white/8 text-center">
          <p className="text-xs text-white/30">
            Already have an account?{" "}
            <Link href="/auth/login" className="text-blue-400 hover:underline">Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
