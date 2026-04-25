"use client";

import { useEffect, useState } from "react";
import type { MaterialLibraryEntry } from "@/types/database";

const CATEGORIES = ["Exterior", "Flooring", "Countertops", "Cabinetry", "Walls", "Roofing", "Other"];

const DEFAULT_FORM = {
  name: "",
  category: "Exterior",
  base_color: "#8b8b8b",
  roughness: 0.5,
  metalness: 0.0,
  normal_map_url: "",
  thumbnail_url: "",
};

export default function MaterialLibraryPage() {
  const [materials, setMaterials] = useState<MaterialLibraryEntry[]>([]);
  const [loading, setLoading]     = useState(true);
  const [showAdd, setShowAdd]     = useState(false);
  const [form, setForm]           = useState({ ...DEFAULT_FORM });
  const [saving, setSaving]       = useState(false);
  const [editId, setEditId]       = useState<string | null>(null);
  const [filterCat, setFilterCat] = useState("All");
  const [toast, setToast]         = useState("");

  useEffect(() => {
    fetch("/api/admin/materials")
      .then((r) => r.json())
      .then((d) => { setMaterials(d); setLoading(false); });
  }, []);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(""), 2500);
  }

  async function handleSave() {
    setSaving(true);
    const body = {
      ...form,
      roughness: Number(form.roughness),
      metalness: Number(form.metalness),
      normal_map_url: form.normal_map_url || null,
      thumbnail_url: form.thumbnail_url || null,
    };

    const url = editId ? `/api/admin/materials/${editId}` : "/api/admin/materials";
    const method = editId ? "PATCH" : "POST";
    const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const data = await res.json();

    if (res.ok) {
      if (editId) {
        setMaterials((prev) => prev.map((m) => (m.id === editId ? data : m)));
      } else {
        setMaterials((prev) => [...prev, data]);
      }
      setShowAdd(false);
      setEditId(null);
      setForm({ ...DEFAULT_FORM });
      showToast(editId ? "Material updated" : "Material created");
    } else {
      showToast(`Error: ${data.error}`);
    }
    setSaving(false);
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this material?")) return;
    await fetch(`/api/admin/materials/${id}`, { method: "DELETE" });
    setMaterials((prev) => prev.filter((m) => m.id !== id));
    showToast("Deleted");
  }

  function startEdit(m: MaterialLibraryEntry) {
    setForm({
      name: m.name,
      category: m.category ?? "Other",
      base_color: m.base_color,
      roughness: m.roughness,
      metalness: m.metalness,
      normal_map_url: m.normal_map_url ?? "",
      thumbnail_url: m.thumbnail_url ?? "",
    });
    setEditId(m.id);
    setShowAdd(true);
  }

  const filtered = filterCat === "All" ? materials : materials.filter((m) => m.category === filterCat);

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white p-6">
      {toast && (
        <div className="fixed top-4 right-4 z-50 px-4 py-2 bg-white/10 border border-white/20 rounded-xl text-sm text-white backdrop-blur-xl">
          {toast}
        </div>
      )}

      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold">Material Library</h1>
            <p className="text-white/40 text-sm mt-0.5">PBR materials reusable across all R3F projects</p>
          </div>
          <button
            onClick={() => { setShowAdd(true); setEditId(null); setForm({ ...DEFAULT_FORM }); }}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold rounded-xl transition-colors"
          >
            + Add Material
          </button>
        </div>

        {/* Category filter */}
        <div className="flex gap-2 flex-wrap mb-6">
          {["All", ...CATEGORIES].map((cat) => (
            <button
              key={cat}
              onClick={() => setFilterCat(cat)}
              className={`px-3 py-1 rounded-full text-xs font-semibold border transition-colors ${
                filterCat === cat
                  ? "bg-white/15 text-white border-white/25"
                  : "text-white/40 border-white/10 hover:border-white/20"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Add/Edit form */}
        {showAdd && (
          <div className="bg-white/4 border border-white/10 rounded-2xl p-5 mb-6">
            <h2 className="text-white/70 text-sm font-semibold mb-4">{editId ? "Edit Material" : "New Material"}</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-white/40 text-xs mb-1 block">Name *</label>
                <input
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  className="w-full px-3 py-2 bg-white/6 border border-white/10 rounded-lg text-sm text-white placeholder-white/30 focus:outline-none"
                  placeholder="e.g. Charcoal Siding"
                />
              </div>
              <div>
                <label className="text-white/40 text-xs mb-1 block">Category</label>
                <select
                  value={form.category}
                  onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                  className="w-full px-3 py-2 bg-[#111] border border-white/10 rounded-lg text-sm text-white focus:outline-none"
                >
                  {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="text-white/40 text-xs mb-1 block">Base Color *</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={form.base_color}
                    onChange={(e) => setForm((f) => ({ ...f, base_color: e.target.value }))}
                    className="w-10 h-9 rounded cursor-pointer bg-transparent border-0"
                  />
                  <input
                    value={form.base_color}
                    onChange={(e) => setForm((f) => ({ ...f, base_color: e.target.value }))}
                    className="flex-1 px-3 py-2 bg-white/6 border border-white/10 rounded-lg text-sm text-white font-mono focus:outline-none"
                    placeholder="#8b8b8b"
                  />
                </div>
              </div>
              <div>
                <label className="text-white/40 text-xs mb-1 block">Thumbnail URL</label>
                <input
                  value={form.thumbnail_url}
                  onChange={(e) => setForm((f) => ({ ...f, thumbnail_url: e.target.value }))}
                  className="w-full px-3 py-2 bg-white/6 border border-white/10 rounded-lg text-sm text-white placeholder-white/30 focus:outline-none"
                  placeholder="https://…"
                />
              </div>
              <div>
                <label className="text-white/40 text-xs mb-1 block">Roughness (0–1)</label>
                <div className="flex items-center gap-3">
                  <input
                    type="range" min={0} max={1} step={0.01}
                    value={form.roughness}
                    onChange={(e) => setForm((f) => ({ ...f, roughness: parseFloat(e.target.value) }))}
                    className="flex-1"
                  />
                  <span className="text-white/60 text-xs w-8 text-right">{Number(form.roughness).toFixed(2)}</span>
                </div>
              </div>
              <div>
                <label className="text-white/40 text-xs mb-1 block">Metalness (0–1)</label>
                <div className="flex items-center gap-3">
                  <input
                    type="range" min={0} max={1} step={0.01}
                    value={form.metalness}
                    onChange={(e) => setForm((f) => ({ ...f, metalness: parseFloat(e.target.value) }))}
                    className="flex-1"
                  />
                  <span className="text-white/60 text-xs w-8 text-right">{Number(form.metalness).toFixed(2)}</span>
                </div>
              </div>
              <div className="col-span-2">
                <label className="text-white/40 text-xs mb-1 block">Normal Map URL (optional)</label>
                <input
                  value={form.normal_map_url}
                  onChange={(e) => setForm((f) => ({ ...f, normal_map_url: e.target.value }))}
                  className="w-full px-3 py-2 bg-white/6 border border-white/10 rounded-lg text-sm text-white placeholder-white/30 focus:outline-none"
                  placeholder="https://…"
                />
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={handleSave} disabled={saving || !form.name} className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-sm font-semibold rounded-xl transition-colors">
                {saving ? "Saving…" : editId ? "Update" : "Create"}
              </button>
              <button onClick={() => { setShowAdd(false); setEditId(null); }} className="px-4 py-2 bg-white/6 hover:bg-white/10 text-white/60 text-sm rounded-xl transition-colors">
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Material grid */}
        {loading ? (
          <div className="grid grid-cols-4 gap-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-32 bg-white/4 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 text-white/30">
            <div className="text-4xl mb-3">🎨</div>
            <p className="text-sm">No materials yet</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {filtered.map((m) => (
              <div key={m.id} className="bg-white/4 border border-white/8 rounded-xl overflow-hidden group">
                <div
                  className="h-20 relative"
                  style={{ backgroundColor: m.base_color }}
                >
                  {m.thumbnail_url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={m.thumbnail_url} alt={m.name} className="absolute inset-0 w-full h-full object-cover" />
                  )}
                  <div className="absolute top-1.5 right-1.5 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => startEdit(m)} className="w-6 h-6 bg-black/60 hover:bg-black/80 rounded flex items-center justify-center text-white/70 text-xs">✎</button>
                    <button onClick={() => handleDelete(m.id)} className="w-6 h-6 bg-black/60 hover:bg-red-900/80 rounded flex items-center justify-center text-white/70 text-xs">✕</button>
                  </div>
                </div>
                <div className="p-2.5">
                  <p className="text-white text-xs font-medium truncate">{m.name}</p>
                  <p className="text-white/35 text-[10px] mt-0.5">{m.category ?? "—"}</p>
                  <div className="flex gap-2 mt-1.5">
                    <span className="text-white/30 text-[10px]">R {m.roughness.toFixed(1)}</span>
                    <span className="text-white/30 text-[10px]">M {m.metalness.toFixed(1)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
