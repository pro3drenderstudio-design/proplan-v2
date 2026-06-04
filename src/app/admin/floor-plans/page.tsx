"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { getAllBuilders } from "@/lib/admin-api";
import { FloorPlan, Builder, HomeStyle } from "@/types/database";

const HOME_STYLES: { value: HomeStyle; label: string }[] = [
  { value: "ranch",          label: "Ranch"          },
  { value: "two_story",      label: "Two Story"      },
  { value: "craftsman",      label: "Craftsman"      },
  { value: "modern",         label: "Modern"         },
  { value: "colonial",       label: "Colonial"       },
  { value: "cape_cod",       label: "Cape Cod"       },
  { value: "mediterranean",  label: "Mediterranean"  },
  { value: "contemporary",   label: "Contemporary"   },
];

interface FloorPlanRow extends FloorPlan {
  builders: { id: string; company_name: string; company_slug: string; logo_url: string | null };
}

const EMPTY_FORM = {
  builder_id:    "",
  name:          "",
  description:   "",
  beds:          "",
  baths:         "",
  floors:        "",
  sqft_min:      "",
  sqft_max:      "",
  garage_spaces: "",
  home_style:    "" as HomeStyle | "",
  base_price:    "",
  project_id:    "",
};

type FormState = typeof EMPTY_FORM;

function fmtPrice(cents: number) {
  return (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

export default function AdminFloorPlansPage() {
  const searchParams                      = useSearchParams();
  const [plans,         setPlans]         = useState<FloorPlanRow[]>([]);
  const [builders,      setBuilders]      = useState<Builder[]>([]);
  const [loading,       setLoading]       = useState(true);
  const [search,        setSearch]        = useState("");
  const [builderFilter, setBuilderFilter] = useState(searchParams.get("builder") ?? "");

  // Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [editing,   setEditing]   = useState<FloorPlanRow | null>(null);
  const [form,      setForm]      = useState<FormState>(EMPTY_FORM);
  const [saving,    setSaving]    = useState(false);
  const [deleting,  setDeleting]  = useState<string | null>(null);
  const [toast,     setToast]     = useState("");

  // Thumbnail
  const thumbRef                = useRef<HTMLInputElement>(null);
  const [thumbUrl,  setThumbUrl]  = useState<string | null>(null);
  const [thumbBusy, setThumbBusy] = useState(false);

  // Per-floor images
  const [floorImages, setFloorImages] = useState<(string | null)[]>([]);
  const [floorBusy,   setFloorBusy]   = useState<boolean[]>([]);
  const floorRefs = useRef<(HTMLInputElement | null)[]>([]);

  const inputCls = "w-full bg-[#1a1a1a] border border-white/10 rounded-lg px-3 py-2 text-sm text-white/80 focus:outline-none focus:border-blue-500/60 transition-colors placeholder-white/20";
  const labelCls = "block text-[9px] font-bold uppercase tracking-widest text-white/30 mb-1.5";

  function showToast(msg: string) { setToast(msg); setTimeout(() => setToast(""), 3000); }

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (search)        params.set("search", search);
    if (builderFilter) params.set("builderId", builderFilter);
    const res  = await fetch(`/api/admin/floor-plans?${params}`);
    const data = await res.json();
    setPlans(Array.isArray(data) ? data : []);
    setLoading(false);
  }, [search, builderFilter]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    getAllBuilders().then(b => {
      const sorted = b.sort((a, x) => a.company_name.localeCompare(x.company_name));
      setBuilders(sorted);
      // Auto-open modal if ?new=1 is in the URL
      if (searchParams.get("new") === "1") {
        const preselect = searchParams.get("builder") ?? "";
        openNew(preselect);
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function openNew(preselectedBuilderId = "") {
    setEditing(null);
    setForm({ ...EMPTY_FORM, builder_id: preselectedBuilderId });
    setThumbUrl(null);
    setFloorImages([]);
    setFloorBusy([]);
    setModalOpen(true);
  }

  function openEdit(fp: FloorPlanRow) {
    setEditing(fp);
    const floorsNum = fp.floors ?? 0;
    const imgs = (fp.floor_plan_images ?? []) as { url: string; label?: string }[];
    setForm({
      builder_id:    fp.builder_id,
      name:          fp.name,
      description:   fp.description ?? "",
      beds:          fp.beds          != null ? String(fp.beds)          : "",
      baths:         fp.baths         != null ? String(fp.baths)         : "",
      floors:        fp.floors        != null ? String(fp.floors)        : "",
      sqft_min:      fp.sqft_min      != null ? String(fp.sqft_min)      : (fp.sqft != null ? String(fp.sqft) : ""),
      sqft_max:      fp.sqft_max      != null ? String(fp.sqft_max)      : "",
      garage_spaces: fp.garage_spaces != null ? String(fp.garage_spaces) : "",
      home_style:    fp.home_style    ?? "",
      base_price:    fp.base_price    != null ? String(fp.base_price / 100) : "",
      project_id:    fp.project_id    ?? "",
    });
    setThumbUrl(fp.thumbnail_url);
    setFloorImages(Array.from({ length: floorsNum }, (_, i) => imgs[i]?.url ?? null));
    setFloorBusy(Array.from({ length: floorsNum }, () => false));
    setModalOpen(true);
  }

  function closeModal() { setModalOpen(false); setEditing(null); }

  function onFloorsChange(val: string) {
    const n = Math.max(0, Math.min(10, parseInt(val) || 0));
    setFloorImages(prev => Array.from({ length: n }, (_, i) => prev[i] ?? null));
    setFloorBusy(prev  => Array.from({ length: n }, (_, i) => prev[i] ?? false));
    setForm(f => ({ ...f, floors: val }));
  }

  async function uploadThumbnail(file: File) {
    setThumbBusy(true);
    const fd = new FormData();
    fd.append("file", file);
    fd.append("path", `floor-plan-thumbnails/${form.builder_id || "admin"}/${Date.now()}_${file.name}`);
    const res = await fetch("/api/upload", { method: "POST", body: fd });
    if (res.ok) { const { url } = await res.json() as { url: string }; setThumbUrl(url); }
    setThumbBusy(false);
  }

  async function uploadFloorImage(file: File, idx: number) {
    setFloorBusy(prev => { const n = [...prev]; n[idx] = true; return n; });
    const fd = new FormData();
    fd.append("file", file);
    fd.append("path", `floor-plan-images/${form.builder_id || "admin"}/${Date.now()}_floor${idx + 1}_${file.name}`);
    const res = await fetch("/api/upload", { method: "POST", body: fd });
    if (res.ok) {
      const { url } = await res.json() as { url: string };
      setFloorImages(prev => { const n = [...prev]; n[idx] = url; return n; });
    }
    setFloorBusy(prev => { const n = [...prev]; n[idx] = false; return n; });
  }

  async function handleSave() {
    if (!form.name.trim() || !form.builder_id) return;
    setSaving(true);
    const payload = {
      builder_id:        form.builder_id,
      name:              form.name.trim(),
      description:       form.description || null,
      beds:              form.beds          ? Number(form.beds)          : null,
      baths:             form.baths         ? Number(form.baths)         : null,
      floors:            form.floors        ? Number(form.floors)        : null,
      sqft_min:          form.sqft_min      ? Number(form.sqft_min)      : null,
      sqft_max:          form.sqft_max      ? Number(form.sqft_max)      : null,
      sqft:              form.sqft_min      ? Number(form.sqft_min)      : null,
      garage_spaces:     form.garage_spaces ? Number(form.garage_spaces) : null,
      home_style:        form.home_style    || null,
      base_price:        form.base_price    ? Math.round(Number(form.base_price) * 100) : null,
      project_id:        form.project_id    || null,
      thumbnail_url:     thumbUrl,
      floor_plan_images: floorImages
        .map((url, i) => url ? { url, label: `Floor ${i + 1}` } : null)
        .filter((x): x is { url: string; label: string } => x !== null),
    };

    if (editing) {
      const res = await fetch(`/api/admin/floor-plans/${editing.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        setPlans(prev => prev.map(p => p.id === editing.id
          ? { ...p, ...payload, builders: p.builders } as FloorPlanRow : p));
        showToast("Floor plan updated");
        closeModal();
      } else showToast("Save failed");
    } else {
      const res = await fetch("/api/admin/floor-plans", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        const newPlan = await res.json() as FloorPlanRow;
        setPlans(prev => [newPlan, ...prev]);
        showToast("Floor plan created");
        closeModal();
      } else showToast("Create failed");
    }
    setSaving(false);
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this floor plan? Lots assigned to it will lose the assignment.")) return;
    setDeleting(id);
    const res = await fetch(`/api/admin/floor-plans/${id}`, { method: "DELETE" });
    if (res.ok) { setPlans(prev => prev.filter(p => p.id !== id)); showToast("Deleted"); }
    else showToast("Delete failed");
    setDeleting(null);
  }

  // Unique builders from loaded plans for filter dropdown
  const builderOptions = Array.from(
    new Map(plans.map(p => [p.builders.id, p.builders])).values()
  ).sort((a, b) => a.company_name.localeCompare(b.company_name));

  // Group by builder when not filtering
  const grouped = builderFilter
    ? { [builderFilter]: plans }
    : plans.reduce<Record<string, FloorPlanRow[]>>((acc, p) => {
        const key = p.builders.id;
        if (!acc[key]) acc[key] = [];
        acc[key].push(p);
        return acc;
      }, {});

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-[#111] border border-white/15 text-white text-sm px-4 py-2.5 rounded-xl shadow-2xl">
          {toast}
        </div>
      )}

      {/* Header */}
      <div className="flex-shrink-0 px-6 py-4 border-b border-white/8 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-base font-bold text-white">Floor Plans</h1>
          <p className="text-xs text-white/35 mt-0.5">{plans.length} plan{plans.length !== 1 ? "s" : ""} across all builders</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-lg px-3 py-1.5">
            <svg className="w-3.5 h-3.5 text-white/25 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <circle cx="11" cy="11" r="8"/><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35"/>
            </svg>
            <input type="text" placeholder="Search plans..." value={search}
              onChange={e => setSearch(e.target.value)}
              className="bg-transparent text-xs text-white/70 placeholder-white/25 outline-none w-40" />
          </div>
          <select value={builderFilter} onChange={e => setBuilderFilter(e.target.value)}
            className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white/60 outline-none">
            <option value="">All Builders</option>
            {builderOptions.map(b => (
              <option key={b.id} value={b.id}>{b.company_name}</option>
            ))}
          </select>
          <button onClick={() => openNew()}
            className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-lg transition-colors flex-shrink-0">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            New Floor Plan
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-6 py-5 space-y-8">
        {loading ? (
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="bg-white/4 border border-white/6 rounded-xl h-52 animate-pulse" />
            ))}
          </div>
        ) : plans.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4 border-2 border-dashed border-white/8 rounded-2xl">
            <div className="w-14 h-14 rounded-2xl bg-white/4 border border-white/8 flex items-center justify-center">
              <svg className="w-7 h-7 text-white/20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75" />
              </svg>
            </div>
            <p className="text-sm text-white/25">No floor plans yet</p>
            <button onClick={() => openNew()} className="px-4 py-2 bg-blue-600 text-xs text-white font-semibold rounded-lg">
              Create first floor plan
            </button>
          </div>
        ) : (
          Object.entries(grouped).map(([builderId, bPlans]) => {
            const bi = bPlans[0].builders;
            return (
              <div key={builderId}>
                {/* Builder header */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2.5">
                    {bi.logo_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={bi.logo_url} alt={bi.company_name} className="h-6 object-contain max-w-[80px]" />
                    ) : (
                      <div className="w-6 h-6 rounded bg-blue-600/30 flex items-center justify-center">
                        <span className="text-[9px] font-bold text-blue-300">{bi.company_name.slice(0, 2).toUpperCase()}</span>
                      </div>
                    )}
                    <Link href={`/admin/builders/${bi.id}`}
                      className="text-sm font-bold text-white hover:text-blue-400 transition-colors">
                      {bi.company_name}
                    </Link>
                    <span className="text-[10px] text-white/25 bg-white/5 px-2 py-0.5 rounded-full">
                      {bPlans.length} plan{bPlans.length !== 1 ? "s" : ""}
                    </span>
                  </div>
                  <button onClick={() => openNew(builderId)}
                    className="flex items-center gap-1 text-[10px] text-blue-400 border border-blue-500/25 px-2.5 py-1 rounded-lg hover:bg-blue-500/10 transition-colors">
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4"/></svg>
                    Add Plan
                  </button>
                </div>

                {/* Cards */}
                <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
                  {bPlans.map(fp => (
                    <div key={fp.id} className="bg-[#1a1a1a] border border-white/8 rounded-xl overflow-hidden hover:border-white/14 transition-colors group">
                      <div className="relative">
                        {fp.thumbnail_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={fp.thumbnail_url} alt={fp.name} className="w-full h-28 object-cover" />
                        ) : (
                          <div className="w-full h-28 bg-white/3 flex items-center justify-center">
                            <svg className="w-7 h-7 text-white/8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
                            </svg>
                          </div>
                        )}
                        {fp.project_id && (
                          <span className="absolute top-2 right-2 text-[9px] font-bold px-1.5 py-0.5 rounded bg-blue-600/90 text-white">3D</span>
                        )}
                      </div>
                      <div className="p-3">
                        <div className="flex items-start justify-between gap-1 mb-1.5">
                          <p className="text-xs font-bold text-white leading-tight">{fp.name}</p>
                          {fp.base_price != null && (
                            <p className="text-[10px] font-bold text-white/50 flex-shrink-0">{fmtPrice(fp.base_price)}</p>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-1 mb-2.5">
                          {[
                            fp.beds    != null && `${fp.beds}bd`,
                            fp.baths   != null && `${fp.baths}ba`,
                            (fp.sqft_min ?? fp.sqft) != null && (
                              fp.sqft_max && fp.sqft_max !== (fp.sqft_min ?? fp.sqft)
                                ? `${(fp.sqft_min ?? fp.sqft)!.toLocaleString()}–${fp.sqft_max.toLocaleString()}sf`
                                : `${(fp.sqft_min ?? fp.sqft)!.toLocaleString()}sf`
                            ),
                            fp.garage_spaces != null && `${fp.garage_spaces}gar`,
                          ].filter(Boolean).map((s, i) => (
                            <span key={i} className="text-[9px] text-white/35 bg-white/4 px-1 py-0.5 rounded">{s}</span>
                          ))}
                        </div>
                        <div className="flex gap-1.5">
                          <button onClick={() => openEdit(fp)}
                            className="flex-1 py-1 rounded-lg border border-white/10 text-[10px] text-white/50 hover:text-white hover:border-white/25 transition-colors">
                            Edit
                          </button>
                          <button onClick={() => handleDelete(fp.id)} disabled={deleting === fp.id}
                            className="px-2 py-1 rounded-lg border border-red-500/15 text-[10px] text-red-400/50 hover:text-red-400 hover:border-red-500/35 transition-colors disabled:opacity-40">
                            {deleting === fp.id ? "…" : "Delete"}
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={closeModal} />
          <div className="relative w-full max-w-xl bg-[#111] border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
            {/* Header */}
            <div className="px-5 py-4 border-b border-white/8 flex items-center justify-between flex-shrink-0">
              <h2 className="text-base font-bold text-white">{editing ? "Edit Floor Plan" : "New Floor Plan"}</h2>
              <button onClick={closeModal} className="w-8 h-8 flex items-center justify-center rounded-xl text-white/30 hover:text-white hover:bg-white/8 transition-colors">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-5 space-y-5">

              {/* Builder selector */}
              <div>
                <label className={labelCls}>Assign to Builder *</label>
                <select value={form.builder_id}
                  onChange={e => setForm(f => ({ ...f, builder_id: e.target.value }))}
                  className={inputCls}
                  disabled={!!editing}>
                  <option value="">— Select a builder —</option>
                  {builders.map(b => (
                    <option key={b.id} value={b.id}>{b.company_name}</option>
                  ))}
                </select>
                {editing && <p className="text-[10px] text-white/20 mt-1">Builder cannot be changed after creation</p>}
              </div>

              {/* Thumbnail */}
              <div>
                <label className={labelCls}>Thumbnail</label>
                <div className="flex items-center gap-3">
                  <div className="w-20 h-16 rounded-xl bg-[#1a1a1a] border border-white/10 overflow-hidden flex items-center justify-center flex-shrink-0">
                    {thumbUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={thumbUrl} alt="thumb" className="w-full h-full object-cover" />
                    ) : (
                      <svg className="w-6 h-6 text-white/15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
                      </svg>
                    )}
                  </div>
                  <div>
                    <input ref={thumbRef} type="file" accept="image/*" className="hidden"
                      onChange={e => { const f = e.target.files?.[0]; if (f) uploadThumbnail(f); e.target.value = ""; }} />
                    <button onClick={() => thumbRef.current?.click()} disabled={thumbBusy}
                      className="px-3 py-1.5 border border-white/12 text-xs text-white/50 hover:text-white rounded-lg transition-colors disabled:opacity-40">
                      {thumbBusy ? "Uploading…" : "Upload image"}
                    </button>
                    {thumbUrl && (
                      <button onClick={() => setThumbUrl(null)} className="ml-2 text-xs text-white/25 hover:text-red-400 transition-colors">Remove</button>
                    )}
                  </div>
                </div>
              </div>

              {/* Name */}
              <div>
                <label className={labelCls}>Name *</label>
                <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="The Willow" className={inputCls} />
              </div>

              {/* Description */}
              <div>
                <label className={labelCls}>Description</label>
                <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  rows={2} placeholder="Brief overview of this home design…" className={`${inputCls} resize-none`} />
              </div>

              {/* Home Style */}
              <div>
                <label className={labelCls}>Home Style</label>
                <select value={form.home_style} onChange={e => setForm(f => ({ ...f, home_style: e.target.value as HomeStyle | "" }))}
                  className={inputCls}>
                  <option value="">— Select style —</option>
                  {HOME_STYLES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </div>

              {/* Specs */}
              <div className="grid grid-cols-3 gap-3">
                {([
                  { key: "beds",          label: "Bedrooms",       placeholder: "3"      },
                  { key: "baths",         label: "Bathrooms",      placeholder: "2.5"    },
                  { key: "garage_spaces", label: "Garage Spaces",  placeholder: "2"      },
                  { key: "base_price",    label: "Base Price ($)",  placeholder: "450000" },
                ] as const).map(({ key, label, placeholder }) => (
                  <div key={key}>
                    <label className={labelCls}>{label}</label>
                    <input type="number" min={0} value={form[key]}
                      onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                      placeholder={placeholder} className={inputCls} />
                  </div>
                ))}
                <div>
                  <label className={labelCls}>Floors</label>
                  <input type="number" min={0} max={10} value={form.floors}
                    onChange={e => onFloorsChange(e.target.value)}
                    placeholder="2" className={inputCls} />
                </div>
              </div>

              {/* Sqft range */}
              <div>
                <label className={labelCls}>Square Footage Range</label>
                <div className="flex items-center gap-2">
                  <input type="number" min={0} value={form.sqft_min}
                    onChange={e => setForm(f => ({ ...f, sqft_min: e.target.value }))}
                    placeholder="Min (e.g. 1700)" className={inputCls} />
                  <span className="text-white/30 text-xs flex-shrink-0">to</span>
                  <input type="number" min={0} value={form.sqft_max}
                    onChange={e => setForm(f => ({ ...f, sqft_max: e.target.value }))}
                    placeholder="Max (e.g. 1800)" className={inputCls} />
                </div>
                <p className="text-[10px] text-white/25 mt-1">Leave Max blank for a single value</p>
              </div>

              {/* Per-floor images */}
              {floorImages.length > 0 && (
                <div>
                  <label className={labelCls}>Floor Plan Images</label>
                  <p className="text-[10px] text-white/25 mb-3">Upload a top-down floor plan image for each floor</p>
                  <div className="space-y-2">
                    {floorImages.map((url, i) => (
                      <div key={i} className="flex items-center gap-3 p-3 bg-[#1a1a1a] border border-white/8 rounded-xl">
                        <div className="w-16 h-12 rounded-lg bg-[#111] border border-white/8 overflow-hidden flex-shrink-0 flex items-center justify-center">
                          {url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={url} alt={`Floor ${i + 1}`} className="w-full h-full object-cover" />
                          ) : (
                            <svg className="w-5 h-5 text-white/12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75" />
                            </svg>
                          )}
                        </div>
                        <div className="flex-1">
                          <p className="text-xs font-semibold text-white/60">Floor {i + 1}</p>
                          <input type="file" accept="image/*" className="hidden"
                            ref={el => { floorRefs.current[i] = el; }}
                            onChange={e => { const f = e.target.files?.[0]; if (f) uploadFloorImage(f, i); e.target.value = ""; }} />
                          <button onClick={() => floorRefs.current[i]?.click()} disabled={floorBusy[i]}
                            className="text-[11px] text-blue-400/70 hover:text-blue-400 transition-colors mt-0.5 disabled:opacity-40">
                            {floorBusy[i] ? "Uploading…" : url ? "Replace" : "Upload image"}
                          </button>
                        </div>
                        {url && (
                          <button onClick={() => setFloorImages(prev => { const n = [...prev]; n[i] = null; return n; })}
                            className="text-white/20 hover:text-red-400 transition-colors flex-shrink-0">
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-5 py-4 border-t border-white/8 flex-shrink-0">
              <button onClick={handleSave} disabled={saving || !form.name.trim() || !form.builder_id}
                className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-sm text-white font-semibold transition-colors disabled:opacity-50">
                {saving ? "Saving…" : editing ? "Save Changes" : "Create Floor Plan"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
