"use client";

import { useEffect, useRef, useState, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import SketchfabViewer, { ViewerStatus } from "@/components/SketchfabViewer";
import PhaseController from "@/components/PhaseController";
import OptionsPanel from "@/components/OptionsPanel";
import ProjectInfoCard from "@/components/ProjectInfoCard";
import FloorToggle from "@/components/FloorToggle";
import Preloader, { PreloaderStatus } from "@/components/Preloader";
import QuoteModal from "@/components/QuoteModal";
import { PHASES, PhaseId } from "@/constants/phases";
import { setPhaseCamera, SketchfabCameraApi, CameraCoords, TRANSITION_DURATION } from "@/utils/sketchfab-camera";
import { LevelId } from "@/logic/visibilityController";
import { getProjectBySlugs, getCategoriesWithOptions } from "@/lib/supabase";
import { CategoryWithOptions, Option, PhaseColumn, Project } from "@/types/database";

interface ConfigState {
  currentPhase: PhaseId;
  currentLevel: LevelId;
  activeOverride: CameraCoords | null;
}

interface Props {
  companySlug: string;
  projectSlug: string;
}

export default function ConfiguratorClient({ companySlug, projectSlug }: Props) {
  const [isLoaded, setIsLoaded]         = useState(false);
  const [viewerStatus, setViewerStatus] = useState<ViewerStatus>("loading");
  const apiRef = useRef<SketchfabCameraApi | null>(null);

  const [config, setConfig] = useState<ConfigState>({
    currentPhase: "blueprint",
    currentLevel: 1,
    activeOverride: null,
  });

  const [project, setProject]                     = useState<Project | null>(null);
  const [builder, setBuilder]                     = useState<{ company_name: string; logo_url: string | null; accent_color: string | null; contact_email: string | null; phone: string | null; billing_address: string | null; city: string | null; state: string | null; zip: string | null } | null>(null);
  const [categoriesByPhase, setCategoriesByPhase] = useState<Record<PhaseColumn, CategoryWithOptions[]>>({
    blueprint: [],
    interior:  [],
    exterior:  [],
  });
  const [selectedOptions, setSelectedOptions]   = useState<Record<string, Option>>({});
  const [showQuoteModal, setShowQuoteModal]     = useState(false);
  const [quoteScreenshot, setQuoteScreenshot]   = useState<string | null>(null);
  const [notFound, setNotFound]                 = useState(false);
  const [optionsPanelOpen, setOptionsPanelOpen] = useState(false);

  // Lot context passed from community map
  const searchParams = useSearchParams();
  const lotInfo = useMemo(() => {
    const lotId           = searchParams.get("lotId");
    const lotNumber       = searchParams.get("lotNumber");
    const communitySlug   = searchParams.get("communitySlug");
    const communityName   = searchParams.get("communityName");
    const lotPriceModifier = parseInt(searchParams.get("lotPriceModifier") ?? "0", 10);
    if (!lotId || !lotNumber) return null;
    return { lotId, lotNumber, communitySlug: communitySlug ?? "", communityName: communityName ?? "", priceModifier: lotPriceModifier };
  }, [searchParams]);

  // ── Derived ────────────────────────────────────────────────────────────────
  const allCategories = useMemo(
    () => Object.values(categoriesByPhase).flat(),
    [categoriesByPhase]
  );

  const allOptionNodes = useMemo(() => {
    const all = allCategories.flatMap(cat =>
      cat.options.flatMap(opt => opt.node_list ?? [])
    );
    return [...new Set(all)];
  }, [allCategories]);

  const selectedNodes = useMemo(() => {
    const activeOptionIds = new Set(Object.values(selectedOptions).map(o => o.id));
    return Object.values(selectedOptions).flatMap(opt =>
      (opt.node_list ?? []).filter(nodeName => {
        const conditionId = opt.node_conditions?.[nodeName];
        return !conditionId || activeOptionIds.has(conditionId);
      })
    );
  }, [selectedOptions]);

  const totalPrice = useMemo(() => {
    const base     = project?.base_price ?? 0;
    const addons   = Object.values(selectedOptions).reduce(
      (sum, opt) => sum + (opt.price_impact ?? 0), 0
    );
    const lotPremium = lotInfo?.priceModifier ?? 0;
    return base + addons + lotPremium;
  }, [project, selectedOptions, lotInfo]);

  const floors    = Math.min(project?.floors ?? 1, 3) as LevelId;
  const phaseIndex = PHASES.findIndex(p => p.id === config.currentPhase);

  // ── Data loading ───────────────────────────────────────────────────────────
  useEffect(() => {
    fetch(`/api/builders/public/${encodeURIComponent(companySlug)}`)
      .then(r => r.ok ? r.json() : null)
      .then(b => setBuilder(b?.company_name ? b : null))
      .catch(() => {});
    getProjectBySlugs(companySlug, projectSlug).then(p => {
      if (!p) { setNotFound(true); return; }
      setProject(p);
      getCategoriesWithOptions(p.id).then(flat => {
        const grouped: Record<PhaseColumn, CategoryWithOptions[]> = {
          blueprint: [], interior: [], exterior: [],
        };
        for (const cat of flat) grouped[cat.phase].push(cat);
        setCategoriesByPhase(grouped);
      });
    });
  }, [companySlug, projectSlug]);

  useEffect(() => {
    if (allCategories.length === 0) return;
    setSelectedOptions(prev => {
      const seeded = { ...prev };
      for (const cat of allCategories) {
        if (seeded[cat.id]) continue;
        const defaultOpt =
          cat.options.find(o => o.friendly_name === cat.default_option) ?? cat.options[0];
        if (defaultOpt) seeded[cat.id] = defaultOpt;
      }
      return seeded;
    });
  }, [allCategories]);

  // ── Handlers ───────────────────────────────────────────────────────────────
  function handleStatusChange(status: ViewerStatus) {
    setViewerStatus(status);
    if (status === "ready") setIsLoaded(true);
  }

  function handlePhaseChange(phase: PhaseId) {
    setConfig(prev => ({ ...prev, currentPhase: phase, activeOverride: null }));
    if (phase !== "exterior") setShowQuoteModal(false);
  }

  function handlePrevStep() {
    if (phaseIndex > 0) handlePhaseChange(PHASES[phaseIndex - 1].id);
  }

  function handleNextStep() {
    if (phaseIndex < PHASES.length - 1) handlePhaseChange(PHASES[phaseIndex + 1].id);
  }

  function handleLevelChange(level: LevelId) {
    setConfig(prev => ({ ...prev, currentLevel: level }));
  }

  function handleOptionSelect(categoryId: string, option: Option) {
    const category = allCategories.find(c => c.id === categoryId);
    setConfig(prev => ({
      ...prev,
      activeOverride: category?.camera_override ?? prev.activeOverride,
    }));
    setSelectedOptions(prev => ({ ...prev, [categoryId]: option }));
  }

  function handleApiReady(api: SketchfabCameraApi) {
    apiRef.current = api;
    const phaseCamera = project?.camera_defaults?.[config.currentPhase] ?? undefined;
    setPhaseCamera(api, config.currentPhase, config.activeOverride ?? phaseCamera);
  }

  useEffect(() => {
    if (!isLoaded || !apiRef.current) return;
    const phaseCamera = project?.camera_defaults?.[config.currentPhase] ?? undefined;
    setPhaseCamera(apiRef.current, config.currentPhase, config.activeOverride ?? phaseCamera);
  }, [isLoaded, config.currentPhase, config.activeOverride, project]);

  // ── Not found ─────────────────────────────────────────────────────────────
  if (notFound) {
    return (
      <div className="flex items-center justify-center w-screen h-screen bg-[#0f172a] text-white">
        <div className="text-center">
          <p className="text-5xl font-bold mb-3">404</p>
          <p className="text-white/50">Project not found</p>
        </div>
      </div>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  const preloaderStatus: PreloaderStatus =
    allCategories.length === 0 ? "initializing" : "optimizing";

  const isExterior = config.currentPhase === "exterior";

  return (
    <div className="relative w-screen h-screen bg-black overflow-hidden">
      {project && (
        <SketchfabViewer
          modelId={project.sketchfab_uid}
          currentPhase={config.currentPhase}
          currentLevel={config.currentLevel}
          selectedOptions={selectedNodes}
          allOptionNodes={allOptionNodes}
          onApiReady={handleApiReady}
          onStatusChange={handleStatusChange}
        />
      )}

      <Preloader status={preloaderStatus} visible={!isLoaded} />

      {isLoaded && (
        <>
          <PhaseController currentPhase={config.currentPhase} setPhase={handlePhaseChange} />

          {/* Builder logo — top left */}
          {builder && (
            <div className="absolute top-5 left-4 z-50">
              <div
                className="flex items-center gap-2.5 rounded-xl px-3 py-2"
                style={{
                  background: "rgba(0,0,0,0.55)",
                  backdropFilter: "blur(24px)",
                  WebkitBackdropFilter: "blur(24px)",
                  border: "1px solid rgba(255,255,255,0.09)",
                }}
              >
                {builder.logo_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={builder.logo_url} alt={builder.company_name} className="h-6 object-contain" />
                ) : (
                  <span
                    className="text-xs font-black text-white"
                    style={{ fontFamily: "var(--font-syne), sans-serif" }}
                  >
                    {builder.company_name}
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Total estimate — top right */}
          <div className="absolute top-5 right-4 z-50">
            <div
              className="rounded-xl px-4 py-2.5 text-right"
              style={{
                background: "rgba(0,0,0,0.55)",
                backdropFilter: "blur(24px)",
                WebkitBackdropFilter: "blur(24px)",
                border: "1px solid rgba(255,255,255,0.09)",
              }}
            >
              <p
                className="text-[9px] font-bold uppercase tracking-[0.15em] mb-0.5"
                style={{ color: "rgba(255,255,255,0.3)" }}
              >
                Total Estimate
              </p>
              <p
                className="text-base sm:text-xl font-extrabold text-white leading-none"
                style={{ fontFamily: "var(--font-syne), sans-serif" }}
              >
                {totalPrice.toLocaleString("en-US", {
                  style: "currency",
                  currency: "USD",
                  maximumFractionDigits: 0,
                })}
              </p>
              {lotInfo && lotInfo.priceModifier !== 0 && (
                <p className="text-[10px] mt-0.5" style={{ color: "rgba(251,191,36,0.8)" }}>
                  {lotInfo.priceModifier > 0 ? "+" : "−"}
                  {Math.abs(lotInfo.priceModifier).toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 })} {lotInfo.lotNumber} premium
                </p>
              )}
            </div>
          </div>

          {project && <ProjectInfoCard project={project} />}

          {allCategories.length > 0 && (
            <OptionsPanel
              categories={allCategories}
              currentPhase={config.currentPhase}
              selectedOptions={Object.fromEntries(
                Object.entries(selectedOptions).map(([catId, opt]) => [catId, opt.id])
              )}
              onOptionSelect={handleOptionSelect}
              isOpen={optionsPanelOpen}
            />
          )}

          {/* Options panel backdrop on mobile */}
          {optionsPanelOpen && (
            <div
              className="fixed inset-0 z-40 md:hidden"
              onClick={() => setOptionsPanelOpen(false)}
            />
          )}

          {/* Options FAB — mobile only, above bottom bar */}
          {allCategories.length > 0 && (
            <button
              onClick={() => setOptionsPanelOpen(v => !v)}
              className="md:hidden absolute bottom-[88px] right-4 z-[60] w-12 h-12 rounded-full flex items-center justify-center transition-all duration-150 shadow-xl"
              style={{
                background: optionsPanelOpen ? "rgba(59,130,246,0.9)" : "rgba(15,15,15,0.85)",
                backdropFilter: "blur(24px)",
                WebkitBackdropFilter: "blur(24px)",
                border: optionsPanelOpen ? "1.5px solid rgba(59,130,246,0.6)" : "1.5px solid rgba(255,255,255,0.18)",
                boxShadow: optionsPanelOpen ? "0 4px 24px rgba(59,130,246,0.45)" : "0 4px 20px rgba(0,0,0,0.6)",
              }}
            >
              <svg viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4" style={{ color: optionsPanelOpen ? "white" : "rgba(255,255,255,0.75)" }}>
                <path d="M2 4.75A.75.75 0 0 1 2.75 4h10.5a.75.75 0 0 1 0 1.5H2.75A.75.75 0 0 1 2 4.75ZM2 8a.75.75 0 0 1 .75-.75h10.5a.75.75 0 0 1 0 1.5H2.75A.75.75 0 0 1 2 8Zm0 3.25a.75.75 0 0 1 .75-.75h10.5a.75.75 0 0 1 0 1.5H2.75a.75.75 0 0 1-.75-.75Z" />
              </svg>
            </button>
          )}

          {/* Bottom bar — Prev | FloorToggle | Next/Quote */}
          <div className="absolute bottom-5 left-0 right-0 z-50 flex items-center justify-center gap-2 sm:gap-3">

            {/* Previous — icon-only circle on mobile */}
            <button
              onClick={handlePrevStep}
              disabled={phaseIndex === 0}
              className="w-10 h-10 sm:w-auto sm:h-auto flex items-center justify-center sm:gap-2 sm:px-5 sm:py-2.5 rounded-xl text-xs font-semibold uppercase tracking-widest transition-all duration-150 disabled:opacity-25"
              style={{
                background: "rgba(0,0,0,0.55)",
                backdropFilter: "blur(24px)",
                WebkitBackdropFilter: "blur(24px)",
                border: "1px solid rgba(255,255,255,0.09)",
                color: "rgba(255,255,255,0.6)",
              }}
            >
              <svg viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5 flex-shrink-0">
                <path fillRule="evenodd" d="M9.78 4.22a.75.75 0 0 1 0 1.06L7.06 8l2.72 2.72a.75.75 0 1 1-1.06 1.06l-3.25-3.25a.75.75 0 0 1 0-1.06l3.25-3.25a.75.75 0 0 1 1.06 0z" clipRule="evenodd" />
              </svg>
              <span className="hidden sm:inline">Previous</span>
            </button>

            <FloorToggle
              floors={floors}
              currentLevel={config.currentLevel}
              currentPhase={config.currentPhase}
              onLevelChange={handleLevelChange}
            />

            {/* Options toggle — desktop only (mobile uses FAB above) */}
            {allCategories.length > 0 && (
              <button
                onClick={() => setOptionsPanelOpen(v => !v)}
                className="hidden md:flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-semibold uppercase tracking-widest transition-all duration-150"
                style={{
                  background: optionsPanelOpen ? "rgba(59,130,246,0.25)" : "rgba(0,0,0,0.55)",
                  backdropFilter: "blur(24px)",
                  WebkitBackdropFilter: "blur(24px)",
                  border: optionsPanelOpen ? "1px solid rgba(59,130,246,0.45)" : "1px solid rgba(255,255,255,0.09)",
                  color: optionsPanelOpen ? "rgba(147,197,253,1)" : "rgba(255,255,255,0.6)",
                }}
              >
                <svg viewBox="0 0 16 16" fill="currentColor" className="w-3 h-3">
                  <path d="M2 4.75A.75.75 0 0 1 2.75 4h10.5a.75.75 0 0 1 0 1.5H2.75A.75.75 0 0 1 2 4.75ZM2 8a.75.75 0 0 1 .75-.75h10.5a.75.75 0 0 1 0 1.5H2.75A.75.75 0 0 1 2 8Zm0 3.25a.75.75 0 0 1 .75-.75h10.5a.75.75 0 0 1 0 1.5H2.75a.75.75 0 0 1-.75-.75Z" />
                </svg>
                Options
              </button>
            )}

            {/* Next Step / Get Quote */}
            {isExterior ? (
              <button
                onClick={async () => {
                  const api = apiRef.current;
                  // Move to the canonical exterior camera before snapshotting
                  // so the render is always from a consistent angle.
                  await new Promise<void>(resolve => {
                    if (!api) { resolve(); return; }
                    const saved = project?.camera_defaults?.exterior;
                    const phase = PHASES.find(p => p.id === "exterior");
                    const pos    = (saved?.pos    ?? phase?.camera.position ?? [0, 5, 10]) as [number, number, number];
                    const target = (saved?.target ?? phase?.camera.target   ?? [0, 0, 0])  as [number, number, number];
                    const fov    = saved?.fov ?? phase?.camera.fov ?? 45;
                    api.setFov(fov);
                    api.setCameraLookAt(pos, target, TRANSITION_DURATION);
                    setTimeout(resolve, TRANSITION_DURATION * 1000 + 400);
                  });
                  const snap = await new Promise<string | null>(resolve => {
                    if (!api) { resolve(null); return; }
                    try {
                      api.getScreenShot(1280, 720, (err, result) => {
                        resolve(err ? null : result);
                      });
                    } catch { resolve(null); }
                  });
                  setQuoteScreenshot(snap);
                  setShowQuoteModal(true);
                }}
                className="flex items-center gap-2 px-4 sm:px-5 py-2.5 rounded-xl text-xs font-semibold uppercase tracking-widest transition-all duration-150"
                style={{
                  background: "rgba(16,185,129,0.85)",
                  backdropFilter: "blur(24px)",
                  WebkitBackdropFilter: "blur(24px)",
                  border: "1px solid rgba(16,185,129,0.4)",
                  color: "white",
                  boxShadow: "0 4px 20px rgba(16,185,129,0.3)",
                }}
              >
                <span className="sm:hidden">Quote</span>
                <span className="hidden sm:inline">Get Quote</span>
                <svg viewBox="0 0 16 16" fill="currentColor" className="w-3 h-3">
                  <path d="M7.25 1a.75.75 0 0 1 1.5 0v6.69l2.22-2.22a.75.75 0 1 1 1.06 1.06l-3.5 3.5a.75.75 0 0 1-1.06 0l-3.5-3.5a.75.75 0 1 1 1.06-1.06L7.25 7.69V1Z"/>
                  <path d="M3.25 11a.75.75 0 0 0 0 1.5h9.5a.75.75 0 0 0 0-1.5h-9.5Z"/>
                </svg>
              </button>
            ) : (
              <button
                onClick={handleNextStep}
                disabled={phaseIndex === PHASES.length - 1}
                className="flex items-center gap-2 px-4 sm:px-5 py-2.5 rounded-xl text-xs font-semibold uppercase tracking-widest transition-all duration-150 disabled:opacity-25"
                style={{
                  background: "rgba(37,99,235,0.90)",
                  backdropFilter: "blur(24px)",
                  WebkitBackdropFilter: "blur(24px)",
                  border: "1px solid rgba(37,99,235,0.45)",
                  color: "white",
                  boxShadow: "0 4px 20px rgba(37,99,235,0.30)",
                }}
              >
                <span className="sm:hidden">Next</span>
                <span className="hidden sm:inline">Next Step</span>
                <svg viewBox="0 0 16 16" fill="currentColor" className="w-3 h-3">
                  <path fillRule="evenodd" d="M6.22 4.22a.75.75 0 0 1 1.06 0l3.25 3.25a.75.75 0 0 1 0 1.06l-3.25 3.25a.75.75 0 0 1-1.06-1.06L8.94 8 6.22 5.28a.75.75 0 0 1 0-1.06z" clipRule="evenodd" />
                </svg>
              </button>
            )}
          </div>
        </>
      )}

      {showQuoteModal && project && (
        <QuoteModal
          project={project}
          categories={allCategories}
          selectedOptions={selectedOptions}
          totalPrice={totalPrice}
          screenshot={quoteScreenshot}
          apiRef={apiRef}
          onClose={() => setShowQuoteModal(false)}
          builder={builder}
          lotInfo={lotInfo}
        />
      )}
    </div>
  );
}
