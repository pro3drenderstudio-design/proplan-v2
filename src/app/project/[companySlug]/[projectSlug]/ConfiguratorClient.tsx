"use client";

import React, { Component, useEffect, useRef, useState, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { useGLTF } from "@react-three/drei";
import SketchfabViewer, { ViewerStatus } from "@/components/SketchfabViewer";
import R3FViewer from "@/components/r3f/R3FViewer";
import PhaseController from "@/components/PhaseController";
import OptionsPanel from "@/components/OptionsPanel";
import ProjectInfoCard from "@/components/ProjectInfoCard";
import FloorToggle from "@/components/FloorToggle";
import Preloader from "@/components/Preloader";
import SummaryPage from "@/components/SummaryPage";
import { PHASES, DEFAULT_PHASE, PhaseId } from "@/constants/phases";
import { setPhaseCamera, SketchfabCameraApi, CameraCoords } from "@/utils/sketchfab-camera";
import { LevelId } from "@/logic/visibilityController";
import { getProjectBySlugs, getCategoriesWithOptions } from "@/lib/supabase";
import { CategoryWithOptions, MaterialLibraryEntry, Option, PhaseColumn, Project, SceneRenderSettings, PlacedShapeData } from "@/types/database";

// Catches any render-time errors that escape R3FViewer's CanvasErrorBoundary
// (after 3 retries or from Suspense-related failures), preventing them from
// propagating up to Next.js and unmounting ConfiguratorClient's state.
class ViewerErrorBoundary extends Component<
  { children: React.ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: Error) {
    console.warn("[ConfiguratorClient] Viewer render error caught:", error.message);
  }
  render() {
    if (this.state.failed) {
      return (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-950">
          <p className="text-white/40 text-xs tracking-wide">Renderer failed. Please refresh the page.</p>
        </div>
      );
    }
    return this.props.children;
  }
}


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
  const [everReady, setEverReady]       = useState(false);
  const [phaseOverlay, setPhaseOverlay] = useState<string | null>(null);
  const phaseOverlayTimer               = useRef<ReturnType<typeof setTimeout> | null>(null);
  const apiRef = useRef<SketchfabCameraApi | null>(null);

  const [config, setConfig] = useState<ConfigState>({
    currentPhase: DEFAULT_PHASE,
    currentLevel: 1,
    activeOverride: null,
  });

  const [project, setProject]                     = useState<Project | null>(null);
  const [materialLibrary, setMaterialLibrary]     = useState<MaterialLibraryEntry[]>([]);
  const [builder, setBuilder]                     = useState<{ company_name: string; logo_url: string | null; accent_color: string | null; contact_email: string | null; phone: string | null; billing_address: string | null; city: string | null; state: string | null; zip: string | null } | null>(null);
  const [categoriesByPhase, setCategoriesByPhase] = useState<Record<PhaseColumn, CategoryWithOptions[]>>({
    blueprint: [],
    interior:  [],
    exterior:  [],
  });
  const [selectedOptions, setSelectedOptions]   = useState<Record<string, Option>>({});
  const [showSummary, setShowSummary]           = useState(false);
  const [showLanding, setShowLanding]           = useState(false);
  const [nudgeDismissed, setNudgeDismissed]         = useState(false);
  const [intNudgeDismissed, setIntNudgeDismissed]   = useState(false);
  const [interactedCatIds, setInteractedCatIds]     = useState<Set<string>>(new Set());
  const [favorites, setFavorites]               = useState<Set<string>>(new Set());
  const [phaseScreenshots, setPhaseScreenshots]   = useState<Partial<Record<PhaseId, string | null>>>({});
  const [interior2Screenshot, setInterior2Screenshot] = useState<string | null>(null);
  const [isCapturing, setIsCapturing]           = useState(false);
  const [notFound, setNotFound]                 = useState(false);
  const [optionsPanelOpen, setOptionsPanelOpen] = useState(false);
  const landingShownRef = useRef(false);

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

  const sceneSettings = useMemo<SceneRenderSettings | undefined>(() => {
    if (!project) return undefined;
    const cd = (project.camera_defaults as any);
    // Per-phase lighting (new format)
    const phaseSettings = cd?._phaseSettings as Record<string, SceneRenderSettings> | undefined;
    if (phaseSettings?.[config.currentPhase]) return phaseSettings[config.currentPhase];
    // Legacy single settings fallback
    const saved = cd?._settings as SceneRenderSettings | undefined;
    if (!saved) return { envLightPreset: project.env_preset ?? "apartment" };
    return saved;
  }, [project, config.currentPhase]);

  const meshBaseMatMap = useMemo<Record<string, string>>(() => {
    return (project?.camera_defaults as any)?._meshBaseMats ?? {};
  }, [project]);

  const glbMatOverrides = useMemo(() => {
    return (project?.camera_defaults as any)?._glbMatOverrides ?? {};
  }, [project]);

  const placedProps = useMemo<{ id: string; modelUrl: string; position: [number,number,number]; rotation: [number,number,number]; scale: [number,number,number] }[]>(() => {
    return (project?.camera_defaults as any)?._placedProps ?? [];
  }, [project]);

  const placedShapes = useMemo<PlacedShapeData[]>(() => {
    return (project?.camera_defaults as any)?._placedShapes ?? [];
  }, [project]);

  const placedLights = useMemo(() => {
    return (project?.camera_defaults as any)?._placedLights ?? [];
  }, [project]);

  const structuralArrays = useMemo(() => {
    const cd = (project?.camera_defaults as any);
    // Structural nodes are global — read from exterior phase or fall back to legacy _settings
    const ps = cd?._phaseSettings as Record<string, SceneRenderSettings> | undefined;
    const s = ps?.exterior ?? cd?._settings as SceneRenderSettings | undefined;
    return {
      roofNodes:   s?.roofNodes   ?? [],
      level1Nodes: s?.level1Nodes ?? [],
      level2Nodes: s?.level2Nodes ?? [],
      level3Nodes: s?.level3Nodes ?? [],
    };
  }, [project]);

  const floors     = Math.min(project?.floors ?? 1, 3) as LevelId;
  const phaseIndex = PHASES.findIndex(p => p.id === config.currentPhase);
  const isLastPhase = phaseIndex === PHASES.length - 1;

  const phaseMessage = config.currentPhase === "exterior"
    ? (sceneSettings?.exteriorMessage ?? undefined)
    : config.currentPhase === "interior"
    ? (sceneSettings?.interiorMessage ?? undefined)
    : undefined;

  const selectedOptionIds = new Set(Object.values(selectedOptions).map(o => o.id));

  const visibleExteriorCats = allCategories.filter(c => {
    if (c.phase?.toLowerCase() !== "exterior") return false;
    if (!c.show_when || c.show_when.length === 0) return true;
    return c.show_when.some(id => selectedOptionIds.has(id));
  });
  const allExteriorConfigured = visibleExteriorCats.length > 0 &&
    visibleExteriorCats.every(c => interactedCatIds.has(c.id));

  const visibleInteriorCats = allCategories.filter(c => {
    if (c.phase?.toLowerCase() !== "interior") return false;
    if (!c.show_when || c.show_when.length === 0) return true;
    return c.show_when.some(id => selectedOptionIds.has(id));
  });
  const allInteriorConfigured = visibleInteriorCats.length > 0 &&
    visibleInteriorCats.every(c => interactedCatIds.has(c.id));

  // Exterior → Interior nudge: shown once all exterior cats have been touched
  const showTransitionNudge =
    !nudgeDismissed &&
    config.currentPhase === "exterior" &&
    !isLastPhase &&
    allExteriorConfigured;

  // Interior → Summary nudge: shown once all interior cats have been touched
  const showInteriorNudge =
    !intNudgeDismissed &&
    config.currentPhase === "interior" &&
    allInteriorConfigured;

  // ── Data loading ───────────────────────────────────────────────────────────
  useEffect(() => {
    const ctrl = new AbortController();
    const { signal } = ctrl;

    fetch(`/api/builders/public/${encodeURIComponent(companySlug)}`, { signal })
      .then(r => r.ok ? r.json() : null)
      .then(b => { if (!signal.aborted) setBuilder(b?.company_name ? b : null); })
      .catch(() => {});

    getProjectBySlugs(companySlug, projectSlug).then(p => {
      if (signal.aborted) return;
      if (!p) { setNotFound(true); return; }
      setProject(p);
      if (p.model_url) {
        // Start GLB download immediately — before the Canvas even mounts.
        // useGLTF caches by URL so HomeModel will reuse this in-flight request.
        useGLTF.preload(p.model_url);

        Promise.all([
          fetch("/api/admin/materials", { signal }).then(r => r.ok ? r.json() : []),
          getCategoriesWithOptions(p.id),
        ]).then(([mats, flat]: [MaterialLibraryEntry[], any[]]) => {
          if (signal.aborted) return;

          // Only keep materials referenced by this project's options + base mat map.
          // Reduces in-memory footprint — any other material in the library is irrelevant here.
          const referencedIds = new Set<string>();
          for (const cat of flat) {
            for (const opt of (cat.options ?? [])) {
              if (opt.material_id) referencedIds.add(opt.material_id);
              for (const a of (opt.material_assignments ?? [])) referencedIds.add(a.material_id);
            }
          }
          const meshBaseMats = (p.camera_defaults as any)?._meshBaseMats ?? {};
          for (const id of Object.values(meshBaseMats as Record<string, string>)) referencedIds.add(id);
          setMaterialLibrary(referencedIds.size > 0 ? (mats as MaterialLibraryEntry[]).filter(m => referencedIds.has(m.id)) : mats);

          const grouped: Record<PhaseColumn, CategoryWithOptions[]> = {
            blueprint: [], interior: [], exterior: [],
          };
          for (const cat of flat) grouped[cat.phase as PhaseColumn]?.push(cat);
          setCategoriesByPhase(grouped);
        }).catch(() => {});
      } else {
        getCategoriesWithOptions(p.id).then(flat => {
          if (signal.aborted) return;
          const grouped: Record<PhaseColumn, CategoryWithOptions[]> = {
            blueprint: [], interior: [], exterior: [],
          };
          for (const cat of flat) grouped[cat.phase as PhaseColumn]?.push(cat);
          setCategoriesByPhase(grouped);
        });
      }
    });

    return () => ctrl.abort();
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
    if (status === "ready") {
      setIsLoaded(true);
      setEverReady(true);
      if (!landingShownRef.current) {
        landingShownRef.current = true;
        setShowLanding(true);
      }
    }
  }

  const PHASE_OVERLAY_LABELS: Record<PhaseId, string> = {
    exterior:  "Loading exterior view",
    interior:  "Loading your interior",
    blueprint: "Loading floor plan",
  };

  function handlePhaseChange(phase: PhaseId) {
    setConfig(prev => ({ ...prev, currentPhase: phase, activeOverride: null }));
    setNudgeDismissed(false);
    setIntNudgeDismissed(false);

    // Show a smooth overlay while materials/textures for the new phase load.
    // Only show after the initial load is complete (isLoaded) so it doesn't
    // conflict with the Preloader.
    if (isLoaded) {
      if (phaseOverlayTimer.current) clearTimeout(phaseOverlayTimer.current);
      setPhaseOverlay(PHASE_OVERLAY_LABELS[phase] ?? "Loading…");
      // Keep it up for 1.1 s then fade out — covers most texture download times
      // on a reasonable connection without feeling sluggish.
      phaseOverlayTimer.current = setTimeout(() => setPhaseOverlay(null), 1100);
    }
  }

  function handlePrevStep() {
    if (phaseIndex > 0) handlePhaseChange(PHASES[phaseIndex - 1].id);
  }

  function handleNextStep() {
    if (phaseIndex < PHASES.length - 1) handlePhaseChange(PHASES[phaseIndex + 1].id);
  }

  async function handleOpenSummary() {
    if (!apiRef.current || !project) {
      setShowSummary(true);
      return;
    }
    setIsCapturing(true);
    const api = apiRef.current;
    const originalPhase = config.currentPhase;
    const screenshots: Partial<Record<PhaseId, string | null>> = {};

    for (const phase of PHASES) {
      // Switch to the phase so its lighting/environment is active in the render
      setConfig(prev => ({ ...prev, currentPhase: phase.id, activeOverride: null }));

      const saved  = project.camera_defaults?.[phase.id as "exterior" | "interior"];
      const pos    = (saved?.pos    ?? phase.camera.position) as [number, number, number];
      const target = (saved?.target ?? phase.camera.target)   as [number, number, number];
      const fov    = saved?.fov ?? phase.camera.fov ?? 45;
      api.setFov(fov);
      api.setCameraLookAt(pos, target, 0.6);
      // Wait for phase lighting + camera transition to settle
      await new Promise(resolve => setTimeout(resolve, 2000));
      screenshots[phase.id] = await new Promise<string | null>(resolve => {
        try {
          api.getScreenShot(1280, 720, (err: unknown, result: string) => resolve(err ? null : result));
        } catch { resolve(null); }
      });
    }

    // Capture Interior Camera 2 using interior phase lighting
    let int2Shot: string | null = null;
    const int2Cam = (project.camera_defaults as any)?.interior2 as { pos: [number,number,number]; target: [number,number,number]; fov?: number } | undefined;
    if (int2Cam) {
      api.setFov(int2Cam.fov ?? 45);
      api.setCameraLookAt(int2Cam.pos, int2Cam.target, 0.6);
      await new Promise(resolve => setTimeout(resolve, 2000));
      int2Shot = await new Promise<string | null>(resolve => {
        try {
          api.getScreenShot(1280, 720, (err: unknown, result: string) => resolve(err ? null : result));
        } catch { resolve(null); }
      });
    }

    // Restore original phase
    setConfig(prev => ({ ...prev, currentPhase: originalPhase, activeOverride: null }));

    setPhaseScreenshots(screenshots);
    setInterior2Screenshot(int2Shot);
    setIsCapturing(false);
    setShowSummary(true);
  }

  function handleToggleFavorite(optionId: string) {
    setFavorites(prev => {
      const next = new Set(prev);
      if (next.has(optionId)) next.delete(optionId);
      else next.add(optionId);
      return next;
    });
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
    setInteractedCatIds(prev => prev.has(categoryId) ? prev : new Set([...prev, categoryId]));
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
  const isR3F = project
    ? (project.viewer_mode === "r3f" || (project.viewer_mode == null && !!project.model_url))
    : false;
  // Mount as soon as project data is available — no pre-fetch gating.
  // Matches the scene editor approach which loads the same model without gating.
  const mountViewer = !!project;

  const selectedOptionsForPanel = Object.fromEntries(
    Object.entries(selectedOptions).map(([catId, opt]) => [catId, opt.id])
  );

  return (
    // Mobile: flex column (viewer top, options bottom). Desktop: block with absolute overlays.
    <div className="relative w-screen h-screen overflow-hidden flex flex-col md:relative md:block" style={{ background: "#0d0d0d" }}>

      {/* ── Viewer wrapper ──────────────────────────────────────────────────────
          Mobile : w-full fixed 45vh strip at the top
          Desktop: absolute inset-0 fills the entire screen                   */}
      <div className="relative flex-shrink-0 w-full h-[45vh] md:h-auto md:absolute md:inset-0">
        {mountViewer && (
          <ViewerErrorBoundary>
          {isR3F ? (
            <R3FViewer
              modelUrl={project.model_url!}
              currentPhase={config.currentPhase}
              currentLevel={config.currentLevel as 1 | 2 | 3}
              selectedOptions={selectedNodes}
              allOptionNodes={allOptionNodes}
              selectedOptionObjects={selectedOptions}
              materialLibrary={materialLibrary}
              meshBaseMatMap={meshBaseMatMap}
              glbMatOverrides={glbMatOverrides}
              structuralArrays={structuralArrays}
              placedProps={placedProps}
              placedShapes={placedShapes}
              placedLights={placedLights}
              envPreset={sceneSettings?.envLightPreset ?? project.env_preset ?? "apartment"}
              sceneSettings={sceneSettings}
              initialCamera={project.camera_defaults?.[config.currentPhase] ?? undefined}
              onApiReady={handleApiReady}
              onStatusChange={handleStatusChange}
            />
          ) : (
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
          </ViewerErrorBoundary>
        )}

        <Preloader
          visible={!isLoaded}
          viewerReady={everReady}
          accentColor={builder?.accent_color}
          builderName={builder?.company_name}
          builderLogo={builder?.logo_url}
        />

        {/* Phase transition overlay — hides the 1-second black while new-phase
            textures download. Fades in immediately, fades out after 1.1 s. */}
        <div
          className="absolute inset-0 z-30 flex flex-col items-center justify-center pointer-events-none transition-opacity duration-300"
          style={{
            background: "#0d0d0d",
            opacity: phaseOverlay ? 1 : 0,
          }}
        >
          {phaseOverlay && (
            <div className="flex flex-col items-center gap-3">
              <div className="w-7 h-7 rounded-full border-2 border-white/15 border-t-white/60 animate-spin" />
              <span className="text-[11px] text-white/40 tracking-[0.2em] uppercase select-none">
                {phaseOverlay}
              </span>
            </div>
          )}
        </div>

        {isLoaded && (
          <>
            <PhaseController currentPhase={config.currentPhase} setPhase={handlePhaseChange} />

            {/* Builder logo — top left */}
            {builder && (
              <div className="absolute top-5 left-4 z-50">
                {builder.logo_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={builder.logo_url} alt={builder.company_name} className="h-7 md:h-8 object-contain drop-shadow-[0_2px_8px_rgba(0,0,0,0.6)]" />
                ) : (
                  <span
                    className="text-sm font-black text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.7)]"
                    style={{ fontFamily: "var(--font-syne), sans-serif" }}
                  >
                    {builder.company_name}
                  </span>
                )}
              </div>
            )}

            {/* Total estimate — top right */}
            <div className="absolute top-5 right-4 z-50">
              <div
                className="rounded-xl px-3 py-2 md:px-4 md:py-2.5 text-right"
                style={{
                  background: "rgba(0,0,0,0.55)",
                  backdropFilter: "blur(24px)",
                  WebkitBackdropFilter: "blur(24px)",
                  border: "1px solid rgba(255,255,255,0.09)",
                }}
              >
                <p
                  className="text-[8px] md:text-[9px] font-bold uppercase tracking-[0.15em] mb-0.5"
                  style={{ color: "rgba(255,255,255,0.3)" }}
                >
                  Total
                </p>
                <p
                  className="text-sm md:text-xl font-extrabold text-white leading-none"
                  style={{ fontFamily: "var(--font-syne), sans-serif" }}
                >
                  {totalPrice.toLocaleString("en-US", {
                    style: "currency",
                    currency: "USD",
                    maximumFractionDigits: 0,
                  })}
                </p>
                {lotInfo && lotInfo.priceModifier !== 0 && (
                  <p className="text-[9px] mt-0.5" style={{ color: "rgba(251,191,36,0.8)" }}>
                    {lotInfo.priceModifier > 0 ? "+" : "−"}
                    {Math.abs(lotInfo.priceModifier).toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 })} lot
                  </p>
                )}
              </div>
            </div>

            {/* Project info card — desktop + sm only */}
            {project && <ProjectInfoCard project={project} />}

            {/* ── Desktop-only: options panel (absolute right) ── */}
            <div className="hidden md:block">
              {allCategories.length > 0 && (
                <OptionsPanel
                  categories={allCategories}
                  currentPhase={config.currentPhase}
                  selectedOptions={selectedOptionsForPanel}
                  onOptionSelect={handleOptionSelect}
                  favorites={favorites}
                  onToggleFavorite={handleToggleFavorite}
                  isOpen={true}
                  phaseMessage={phaseMessage}
                />
              )}
            </div>

            {/* ── Desktop-only: phase-completion nudges ── */}
            {showTransitionNudge && (
              <div
                className="hidden md:flex absolute bottom-20 left-1/2 -translate-x-1/2 z-[55] pointer-events-auto items-center gap-3"
                style={{
                  animation: "slideUpFade 0.4s cubic-bezier(0.16,1,0.3,1) both",
                  background: "linear-gradient(135deg, rgba(17,24,54,0.96), rgba(12,14,38,0.96))",
                  backdropFilter: "blur(24px)",
                  WebkitBackdropFilter: "blur(24px)",
                  border: "1px solid rgba(99,102,241,0.3)",
                  borderRadius: 999,
                  boxShadow: "0 8px 32px rgba(37,99,235,0.25)",
                  padding: "8px 14px 8px 10px",
                }}
              >
                <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0"
                  style={{ background: "rgba(99,102,241,0.2)", border: "1px solid rgba(99,102,241,0.4)" }}>
                  <svg viewBox="0 0 16 16" fill="none" stroke="#a5b4fc" strokeWidth={2} className="w-3 h-3">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l3.5 3.5L13 5" />
                  </svg>
                </div>
                <div className="flex-shrink-0">
                  <p className="text-[11px] font-semibold text-white/80 leading-none">Exterior is looking great.</p>
                  <p className="text-[10px] text-white/35 leading-none mt-0.5">Step inside and make it truly yours.</p>
                </div>
                <button
                  onClick={() => { setNudgeDismissed(true); handleNextStep(); }}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-full text-[11px] font-semibold transition-all duration-150 flex-shrink-0"
                  style={{ background: "rgba(99,102,241,0.3)", border: "1px solid rgba(99,102,241,0.45)", color: "#c7d2fe" }}
                >
                  Interior
                  <svg viewBox="0 0 16 16" fill="currentColor" className="w-2.5 h-2.5">
                    <path fillRule="evenodd" d="M6.22 4.22a.75.75 0 0 1 1.06 0l3.25 3.25a.75.75 0 0 1 0 1.06l-3.25 3.25a.75.75 0 0 1-1.06-1.06L8.94 8 6.22 5.28a.75.75 0 0 1 0-1.06z" clipRule="evenodd" />
                  </svg>
                </button>
                <button onClick={() => setNudgeDismissed(true)}
                  className="w-4 h-4 flex items-center justify-center rounded-full flex-shrink-0"
                  style={{ color: "rgba(255,255,255,0.25)" }}>
                  <svg viewBox="0 0 16 16" fill="currentColor" className="w-2.5 h-2.5">
                    <path d="M3.72 3.72a.75.75 0 0 1 1.06 0L8 6.94l3.22-3.22a.75.75 0 1 1 1.06 1.06L9.06 8l3.22 3.22a.75.75 0 1 1-1.06 1.06L8 9.06l-3.22 3.22a.75.75 0 0 1-1.06-1.06L6.94 8 3.72 4.78a.75.75 0 0 1 0-1.06z" />
                  </svg>
                </button>
              </div>
            )}

            {showInteriorNudge && (
              <div
                className="hidden md:flex absolute bottom-20 left-1/2 -translate-x-1/2 z-[55] pointer-events-auto items-center gap-3"
                style={{
                  animation: "slideUpFade 0.4s cubic-bezier(0.16,1,0.3,1) both",
                  background: "linear-gradient(135deg, rgba(6,30,20,0.96), rgba(5,22,16,0.96))",
                  backdropFilter: "blur(24px)",
                  WebkitBackdropFilter: "blur(24px)",
                  border: "1px solid rgba(16,185,129,0.3)",
                  borderRadius: 999,
                  boxShadow: "0 8px 32px rgba(16,185,129,0.2)",
                  padding: "8px 14px 8px 10px",
                }}
              >
                <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0"
                  style={{ background: "rgba(16,185,129,0.15)", border: "1px solid rgba(16,185,129,0.35)" }}>
                  <svg viewBox="0 0 16 16" fill="none" stroke="#34d399" strokeWidth={2} className="w-3 h-3">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l3.5 3.5L13 5" />
                  </svg>
                </div>
                <div className="flex-shrink-0">
                  <p className="text-[11px] font-semibold text-white/80 leading-none">Your home is configured.</p>
                  <p className="text-[10px] text-white/35 leading-none mt-0.5">See your full summary and get a quote.</p>
                </div>
                <button
                  onClick={() => { setIntNudgeDismissed(true); handleOpenSummary(); }}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-full text-[11px] font-semibold transition-all duration-150 flex-shrink-0"
                  style={{ background: "rgba(16,185,129,0.2)", border: "1px solid rgba(16,185,129,0.4)", color: "#6ee7b7" }}
                >
                  View Summary
                  <svg viewBox="0 0 16 16" fill="currentColor" className="w-2.5 h-2.5">
                    <path fillRule="evenodd" d="M6.22 4.22a.75.75 0 0 1 1.06 0l3.25 3.25a.75.75 0 0 1 0 1.06l-3.25 3.25a.75.75 0 0 1-1.06-1.06L8.94 8 6.22 5.28a.75.75 0 0 1 0-1.06z" clipRule="evenodd" />
                  </svg>
                </button>
                <button onClick={() => setIntNudgeDismissed(true)}
                  className="w-4 h-4 flex items-center justify-center rounded-full flex-shrink-0"
                  style={{ color: "rgba(255,255,255,0.25)" }}>
                  <svg viewBox="0 0 16 16" fill="currentColor" className="w-2.5 h-2.5">
                    <path d="M3.72 3.72a.75.75 0 0 1 1.06 0L8 6.94l3.22-3.22a.75.75 0 1 1 1.06 1.06L9.06 8l3.22 3.22a.75.75 0 1 1-1.06 1.06L8 9.06l-3.22 3.22a.75.75 0 0 1-1.06-1.06L6.94 8 3.72 4.78a.75.75 0 0 1 0-1.06z" />
                  </svg>
                </button>
              </div>
            )}

            {/* ── Desktop-only: bottom nav bar ── */}
            <div className="hidden md:flex absolute bottom-5 left-0 right-0 z-50 items-center justify-center gap-3">
              <button
                onClick={handlePrevStep}
                disabled={phaseIndex === 0}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-semibold uppercase tracking-widest transition-all duration-150 disabled:opacity-25"
                style={{
                  background: "rgba(0,0,0,0.55)",
                  backdropFilter: "blur(24px)",
                  WebkitBackdropFilter: "blur(24px)",
                  border: "1px solid rgba(255,255,255,0.09)",
                  color: "rgba(255,255,255,0.6)",
                }}
              >
                <svg viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5">
                  <path fillRule="evenodd" d="M9.78 4.22a.75.75 0 0 1 0 1.06L7.06 8l2.72 2.72a.75.75 0 1 1-1.06 1.06l-3.25-3.25a.75.75 0 0 1 0-1.06l3.25-3.25a.75.75 0 0 1 1.06 0z" clipRule="evenodd" />
                </svg>
                Previous
              </button>

              <FloorToggle
                floors={floors}
                currentLevel={config.currentLevel}
                currentPhase={config.currentPhase}
                onLevelChange={handleLevelChange}
              />

              {isLastPhase ? (
                <button
                  onClick={handleOpenSummary}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-semibold uppercase tracking-widest transition-all duration-150"
                  style={{
                    background: "rgba(16,185,129,0.85)",
                    backdropFilter: "blur(24px)",
                    WebkitBackdropFilter: "blur(24px)",
                    border: "1px solid rgba(16,185,129,0.4)",
                    color: "white",
                    boxShadow: "0 4px 20px rgba(16,185,129,0.3)",
                  }}
                >
                  View Summary
                  <svg viewBox="0 0 16 16" fill="currentColor" className="w-3 h-3">
                    <path fillRule="evenodd" d="M6.22 4.22a.75.75 0 0 1 1.06 0l3.25 3.25a.75.75 0 0 1 0 1.06l-3.25 3.25a.75.75 0 0 1-1.06-1.06L8.94 8 6.22 5.28a.75.75 0 0 1 0-1.06z" clipRule="evenodd" />
                  </svg>
                </button>
              ) : (
                <button
                  onClick={handleNextStep}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-semibold uppercase tracking-widest transition-all duration-150"
                  style={{
                    background: "rgba(37,99,235,0.90)",
                    backdropFilter: "blur(24px)",
                    WebkitBackdropFilter: "blur(24px)",
                    border: "1px solid rgba(37,99,235,0.45)",
                    color: "white",
                    boxShadow: "0 4px 20px rgba(37,99,235,0.30)",
                  }}
                >
                  Next Step
                  <svg viewBox="0 0 16 16" fill="currentColor" className="w-3 h-3">
                    <path fillRule="evenodd" d="M6.22 4.22a.75.75 0 0 1 1.06 0l3.25 3.25a.75.75 0 0 1 0 1.06l-3.25 3.25a.75.75 0 0 1-1.06-1.06L8.94 8 6.22 5.28a.75.75 0 0 1 0-1.06z" clipRule="evenodd" />
                  </svg>
                </button>
              )}
            </div>
          </>
        )}
      </div>{/* end viewer wrapper */}

      {/* ── Mobile-only: options + navigation section ───────────────────────────
          Sits below the viewer in the flex-col layout. Hidden on md+ (desktop
          uses the absolute overlays inside the viewer wrapper above).          */}
      {isLoaded && (
        <div
          className="flex-1 min-h-0 md:hidden flex flex-col overflow-hidden"
          style={{ background: "#070b12" }}
        >
          {/* Scrollable options area */}
          <div
            className="flex-1 overflow-y-auto px-2.5 pt-2.5"
            style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
          >
            {allCategories.length > 0 && (
              <OptionsPanel
                categories={allCategories}
                currentPhase={config.currentPhase}
                selectedOptions={selectedOptionsForPanel}
                onOptionSelect={handleOptionSelect}
                favorites={favorites}
                onToggleFavorite={handleToggleFavorite}
                isOpen={true}
                phaseMessage={phaseMessage}
                stackMode
              />
            )}
          </div>

          {/* Mobile nav bar */}
          <div
            className="flex-shrink-0 flex items-center gap-2 px-3 py-2.5"
            style={{ borderTop: "1px solid rgba(255,255,255,0.07)", background: "#070b12" }}
          >
            <button
              onClick={handlePrevStep}
              disabled={phaseIndex === 0}
              className="w-10 h-10 flex items-center justify-center rounded-xl transition-all duration-150 disabled:opacity-25 flex-shrink-0"
              style={{
                background: "rgba(255,255,255,0.07)",
                border: "1px solid rgba(255,255,255,0.1)",
                color: "rgba(255,255,255,0.6)",
              }}
            >
              <svg viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4">
                <path fillRule="evenodd" d="M9.78 4.22a.75.75 0 0 1 0 1.06L7.06 8l2.72 2.72a.75.75 0 1 1-1.06 1.06l-3.25-3.25a.75.75 0 0 1 0-1.06l3.25-3.25a.75.75 0 0 1 1.06 0z" clipRule="evenodd" />
              </svg>
            </button>

            <FloorToggle
              floors={floors}
              currentLevel={config.currentLevel}
              currentPhase={config.currentPhase}
              onLevelChange={handleLevelChange}
            />

            <div className="flex-1" />

            {isLastPhase ? (
              <button
                onClick={handleOpenSummary}
                className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-semibold uppercase tracking-widest transition-all duration-150"
                style={{
                  background: "rgba(16,185,129,0.85)",
                  border: "1px solid rgba(16,185,129,0.4)",
                  color: "white",
                  boxShadow: "0 4px 20px rgba(16,185,129,0.3)",
                }}
              >
                Summary
                <svg viewBox="0 0 16 16" fill="currentColor" className="w-3 h-3">
                  <path fillRule="evenodd" d="M6.22 4.22a.75.75 0 0 1 1.06 0l3.25 3.25a.75.75 0 0 1 0 1.06l-3.25 3.25a.75.75 0 0 1-1.06-1.06L8.94 8 6.22 5.28a.75.75 0 0 1 0-1.06z" clipRule="evenodd" />
                </svg>
              </button>
            ) : (
              <button
                onClick={handleNextStep}
                className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-semibold uppercase tracking-widest transition-all duration-150"
                style={{
                  background: "rgba(37,99,235,0.90)",
                  border: "1px solid rgba(37,99,235,0.45)",
                  color: "white",
                  boxShadow: "0 4px 20px rgba(37,99,235,0.30)",
                }}
              >
                Next
                <svg viewBox="0 0 16 16" fill="currentColor" className="w-3 h-3">
                  <path fillRule="evenodd" d="M6.22 4.22a.75.75 0 0 1 1.06 0l3.25 3.25a.75.75 0 0 1 0 1.06l-3.25 3.25a.75.75 0 0 1-1.06-1.06L8.94 8 6.22 5.28a.75.75 0 0 1 0-1.06z" clipRule="evenodd" />
                </svg>
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── Landing overlay (shown once after model loads) ── */}
      {showLanding && project && (
        <div
          className="fixed inset-0 z-[150] flex items-center justify-center p-6"
          style={{ background: "rgba(5,7,14,0.88)", backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)" }}
        >
          <div className="flex flex-col items-center text-center max-w-sm gap-6">
            {/* Builder logo */}
            {builder && (
              builder.logo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={builder.logo_url} alt={builder.company_name} className="h-8 object-contain opacity-80" />
              ) : (
                <span className="text-white/55 text-sm font-semibold">{builder.company_name}</span>
              )
            )}

            {/* Project name */}
            <div>
              <p className="text-[9px] font-bold text-white/30 uppercase tracking-[0.22em] mb-2">Configure Your Home</p>
              <h1
                className="text-3xl sm:text-4xl font-extrabold text-white leading-tight"
                style={{ fontFamily: "var(--font-syne), sans-serif" }}
              >
                {project.name}
              </h1>
            </div>

            {/* Welcome message */}
            <p className="text-sm text-white/45 leading-relaxed">
              {sceneSettings?.welcomeMessage ??
                "Personalise every detail of your new home — from exterior finishes to interior materials."}
            </p>

            {/* Phase steps */}
            <div className="flex items-center gap-3">
              {PHASES.map((phase, i) => (
                <div key={phase.id} className="flex items-center gap-3">
                  <div className="flex items-center gap-1.5">
                    <div
                      className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold"
                      style={{ background: "rgba(37,99,235,0.25)", border: "1px solid rgba(37,99,235,0.4)", color: "#93c5fd" }}
                    >
                      {i + 1}
                    </div>
                    <span className="text-white/55 text-xs font-medium">{phase.label}</span>
                  </div>
                  {i < PHASES.length - 1 && (
                    <div style={{ width: 20, height: 1, background: "rgba(255,255,255,0.12)" }} />
                  )}
                </div>
              ))}
            </div>

            {/* CTA */}
            <button
              onClick={() => setShowLanding(false)}
              className="flex items-center gap-2 px-8 py-3 rounded-2xl text-sm font-semibold text-white transition-all duration-200 shadow-xl"
              style={{
                background: "rgba(37,99,235,0.9)",
                border: "1px solid rgba(37,99,235,0.5)",
                boxShadow: "0 8px 32px rgba(37,99,235,0.35)",
              }}
            >
              Start Configuring
              <svg viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5">
                <path fillRule="evenodd" d="M6.22 4.22a.75.75 0 0 1 1.06 0l3.25 3.25a.75.75 0 0 1 0 1.06l-3.25 3.25a.75.75 0 0 1-1.06-1.06L8.94 8 6.22 5.28a.75.75 0 0 1 0-1.06z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* ── Screenshot capture overlay ── */}
      {isCapturing && (
        <div
          className="fixed inset-0 z-[150] flex items-center justify-center"
          style={{ background: "rgba(5,7,14,0.92)" }}
        >
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-2 border-white/15 border-t-white/60 rounded-full animate-spin" />
            <p className="text-white/40 text-xs tracking-widest uppercase">Preparing summary…</p>
          </div>
        </div>
      )}

      {/* ── Summary page ── */}
      {showSummary && project && (
        <SummaryPage
          project={project}
          categories={allCategories}
          selectedOptions={selectedOptions}
          favorites={favorites}
          totalPrice={totalPrice}
          phaseScreenshots={phaseScreenshots}
          interior2Screenshot={interior2Screenshot}
          builder={builder}
          lotInfo={lotInfo}
          onClose={() => setShowSummary(false)}
          onToggleFavorite={handleToggleFavorite}
        />
      )}
    </div>
  );
}
