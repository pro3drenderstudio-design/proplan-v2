"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import dynamic from "next/dynamic";
import SketchfabViewer from "@/components/SketchfabViewer";
import type { CategoryWithOptions, MaterialLibraryEntry, Option, Project } from "@/types/database";
import { PHASES, PhaseId } from "@/constants/phases";
import type { SketchfabCameraApi } from "@/utils/sketchfab-camera";

const R3FViewer = dynamic(() => import("@/components/r3f/R3FViewer"), { ssr: false });

interface SavedConfig {
  id: string;
  token: string;
  project_id: string;
  configuration: Record<string, string>; // categoryId → optionId
  total_price: number;
  phase_snapshot: string | null;
  thumbnail_url: string | null;
  created_at: string;
}

interface PortalData {
  saved: SavedConfig;
  project: Project;
  categories: CategoryWithOptions[];
  materials: MaterialLibraryEntry[];
  builder: { company_name: string; logo_url: string | null; accent_color: string | null } | null;
}

const glassCard: React.CSSProperties = {
  background: "rgba(0,0,0,0.55)",
  backdropFilter: "blur(24px)",
  WebkitBackdropFilter: "blur(24px)",
  border: "1px solid rgba(255,255,255,0.09)",
};

function fmtPrice(n: number) {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

export default function PortalPage() {
  const { token } = useParams<{ token: string }>();
  const [data, setData]       = useState<PortalData | null>(null);
  const [error, setError]     = useState("");
  const [phase, setPhase]     = useState<PhaseId>("exterior");
  const [panelOpen, setPanelOpen] = useState(false);
  const [copied, setCopied]   = useState(false);
  const apiRef = useRef<SketchfabCameraApi | null>(null);

  useEffect(() => {
    fetch(`/api/portal/${token}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) { setError(d.error); return; }
        setData(d);
        if (d.saved.phase_snapshot) setPhase(d.saved.phase_snapshot as PhaseId);
      })
      .catch(() => setError("Failed to load configuration"));
  }, [token]);

  // Rebuild selectedOptions map from saved configuration
  const selectedOptions = useMemo<Record<string, Option>>(() => {
    if (!data) return {};
    const map: Record<string, Option> = {};
    for (const cat of data.categories) {
      const optId = data.saved.configuration[cat.id];
      if (!optId) continue;
      const opt = cat.options.find((o) => o.id === optId);
      if (opt) map[cat.id] = opt;
    }
    return map;
  }, [data]);

  const selectedNodes = useMemo(() => {
    const activeIds = new Set(Object.values(selectedOptions).map((o) => o.id));
    return Object.values(selectedOptions).flatMap((opt) =>
      (opt.node_list ?? []).filter((n) => {
        const cond = opt.node_conditions?.[n];
        return !cond || activeIds.has(cond);
      })
    );
  }, [selectedOptions]);

  const allOptionNodes = useMemo(
    () => [...new Set(data?.categories.flatMap((c) => c.options.flatMap((o) => o.node_list ?? [])) ?? [])],
    [data]
  );

  // Group categories by phase for the summary panel
  const categoriesByPhase = useMemo(() => {
    if (!data) return {} as Record<string, CategoryWithOptions[]>;
    const grouped: Record<string, CategoryWithOptions[]> = {};
    for (const cat of data.categories) {
      if (!grouped[cat.phase]) grouped[cat.phase] = [];
      grouped[cat.phase].push(cat);
    }
    return grouped;
  }, [data]);

  function copyLink() {
    navigator.clipboard.writeText(window.location.href).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  if (error) {
    return (
      <div className="flex items-center justify-center w-screen h-screen bg-[#0a0a0a] text-white">
        <div className="text-center">
          <p className="text-5xl mb-4 opacity-30">⬡</p>
          <p className="font-semibold text-lg mb-1">Configuration not found</p>
          <p className="text-white/40 text-sm">{error}</p>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex items-center justify-center w-screen h-screen bg-[#0a0a0a]">
        <div className="w-10 h-10 border-2 border-white/20 border-t-white/60 rounded-full animate-spin" />
      </div>
    );
  }

  const { saved, project, builder, materials } = data;
  const isR3F = !!project.model_url;

  return (
    <div className="relative w-screen h-screen bg-black overflow-hidden">
      {/* 3D Viewer — full canvas */}
      {isR3F ? (
        <R3FViewer
          modelUrl={project.model_url!}
          currentPhase={phase}
          currentLevel={1}
          selectedOptions={selectedNodes}
          allOptionNodes={allOptionNodes}
          selectedOptionObjects={selectedOptions}
          materialLibrary={materials}
          envPreset={project.env_preset ?? "apartment"}
          onApiReady={(api) => { apiRef.current = api; }}
          onStatusChange={() => {}}
        />
      ) : (
        <SketchfabViewer
          modelId={project.sketchfab_uid}
          currentPhase={phase}
          currentLevel={1}
          selectedOptions={selectedNodes}
          allOptionNodes={allOptionNodes}
          onApiReady={(api) => { apiRef.current = api; }}
          onStatusChange={() => {}}
        />
      )}

      {/* Top bar */}
      <div className="absolute top-0 left-0 right-0 z-50 flex items-center justify-between px-4 pt-4 gap-3">
        {/* Builder / project identity */}
        <div className="rounded-xl px-3 py-2 flex items-center gap-2.5 min-w-0" style={glassCard}>
          {builder?.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={builder.logo_url} alt={builder.company_name} className="h-5 object-contain flex-shrink-0" />
          ) : builder ? (
            <span className="text-xs font-bold text-white flex-shrink-0">{builder.company_name}</span>
          ) : null}
          {builder && <span className="text-white/20 text-xs flex-shrink-0">·</span>}
          <span className="text-white/70 text-sm font-medium truncate">{project.name}</span>
        </div>

        {/* Total + share */}
        <div className="rounded-xl px-4 py-2 text-right flex items-center gap-3" style={glassCard}>
          <div>
            <p className="text-[9px] font-bold uppercase tracking-widest text-white/30">Your Quote</p>
            <p className="text-lg font-extrabold text-white leading-none">{fmtPrice(saved.total_price)}</p>
          </div>
          <button
            onClick={copyLink}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-white/60 hover:text-white text-xs font-medium transition-colors"
          >
            {copied ? "✓ Copied" : "Share"}
          </button>
        </div>
      </div>

      {/* Phase tabs */}
      <div className="absolute bottom-[72px] left-1/2 -translate-x-1/2 z-50 md:bottom-6">
        <div className="flex rounded-2xl overflow-hidden" style={glassCard}>
          {PHASES.map((p) => (
            <button
              key={p.id}
              onClick={() => setPhase(p.id)}
              className={`px-5 py-2.5 text-xs font-semibold uppercase tracking-widest transition-colors ${
                phase === p.id ? "bg-white/15 text-white" : "text-white/40 hover:text-white/60"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Summary panel toggle (mobile) */}
      <button
        onClick={() => setPanelOpen((v) => !v)}
        className="md:hidden absolute bottom-4 right-4 z-50 w-12 h-12 rounded-2xl flex items-center justify-center text-white text-lg"
        style={glassCard}
      >
        {panelOpen ? "×" : "☰"}
      </button>

      {/* Summary panel — desktop right, mobile bottom sheet */}
      <>
        {/* Mobile */}
        {panelOpen && (
          <div
            className="md:hidden fixed left-2 right-2 bottom-[72px] max-h-[60vh] z-[60] rounded-2xl overflow-y-auto p-4"
            style={{ ...glassCard, scrollbarWidth: "none" }}
          >
            <SummaryContent
              categoriesByPhase={categoriesByPhase}
              selectedOptions={selectedOptions}
              totalPrice={saved.total_price}
              savedAt={saved.created_at}
            />
          </div>
        )}

        {/* Desktop */}
        <div
          className="hidden md:flex absolute right-4 top-20 bottom-24 w-[270px] flex-col rounded-2xl overflow-y-auto p-4"
          style={{ ...glassCard, scrollbarWidth: "none" }}
        >
          <SummaryContent
            categoriesByPhase={categoriesByPhase}
            selectedOptions={selectedOptions}
            totalPrice={saved.total_price}
            savedAt={saved.created_at}
          />
        </div>
      </>
    </div>
  );
}

// ─── Summary panel content ────────────────────────────────────────────────────

function SummaryContent({
  categoriesByPhase,
  selectedOptions,
  totalPrice,
  savedAt,
}: {
  categoriesByPhase: Record<string, CategoryWithOptions[]>;
  selectedOptions: Record<string, Option>;
  totalPrice: number;
  savedAt: string;
}) {
  const date = new Date(savedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="text-[9px] font-bold uppercase tracking-widest text-white/30 mb-0.5">Saved Configuration</p>
        <p className="text-white/40 text-[10px]">{date}</p>
      </div>

      {(["blueprint", "interior", "exterior"] as const).map((ph) => {
        const cats = categoriesByPhase[ph];
        if (!cats || cats.length === 0) return null;
        const phaseSelections = cats
          .map((c) => ({ cat: c, opt: selectedOptions[c.id] }))
          .filter((x) => x.opt);
        if (phaseSelections.length === 0) return null;

        return (
          <div key={ph}>
            <p className="text-[9px] font-bold uppercase tracking-widest mb-2"
              style={{ color: ph === "blueprint" ? "#60a5fa" : ph === "interior" ? "#a78bfa" : "#4ade80" }}>
              {ph}
            </p>
            <div className="flex flex-col gap-1">
              {phaseSelections.map(({ cat, opt }) => (
                <div key={cat.id} className="flex items-center justify-between">
                  <div className="min-w-0 flex items-center gap-1.5">
                    {opt.thumbnail_url && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={opt.thumbnail_url} alt="" className="w-4 h-4 rounded-full object-cover flex-shrink-0" />
                    )}
                    <div className="min-w-0">
                      <p className="text-white/40 text-[10px] truncate">{cat.name}</p>
                      <p className="text-white/80 text-xs truncate">{opt.friendly_name}</p>
                    </div>
                  </div>
                  <span className="text-white/30 text-[10px] flex-shrink-0 ml-2">
                    {opt.price_impact === 0 ? "incl." : `+${fmtPrice(opt.price_impact)}`}
                  </span>
                </div>
              ))}
            </div>
          </div>
        );
      })}

      {/* Total */}
      <div className="mt-auto pt-3 border-t border-white/10 flex items-center justify-between">
        <span className="text-white/50 text-xs font-semibold uppercase tracking-wide">Total</span>
        <span className="text-white font-extrabold text-base">{fmtPrice(totalPrice)}</span>
      </div>
    </div>
  );
}
