"use client";

/**
 * Drop-in replacement for SketchfabViewer using React Three Fiber.
 * Accepts the same props surface (minus modelId, plus modelUrl).
 * Projects with model_url use this; projects with sketchfab_uid still use SketchfabViewer.
 */

import React, { Component, Suspense, useEffect, useMemo, useRef, useState } from "react";
import PathTracerController, { PTStatus } from "./PathTracerController";
import { Canvas } from "@react-three/fiber";
import { ACESFilmicToneMapping, SRGBColorSpace } from "three";
import * as THREE from "three";
import { useGLTF } from "@react-three/drei";
import { patchPolyhavenLoader } from "@/lib/three/polyhaven-loader";

patchPolyhavenLoader();
import { PhaseId } from "@/constants/phases";
import { MaterialLibraryEntry, ModelNodeGroups, Option, SceneRenderSettings, PlacedLight, PlacedShapeData, ShapeType } from "@/types/database";
import type { SketchfabCameraApi, CameraCoords } from "@/utils/sketchfab-camera";
import type { LevelId, StructuralNodeArrays } from "@/lib/three/variant-engine";
import CameraRig from "./CameraRig";
import EnvironmentSetup from "./EnvironmentSetup";
import HomeModel from "./HomeModel";

function useAutoLowPerf(): boolean {
  return useMemo(() => {
    if (typeof navigator === "undefined") return false;
    // Only degrade on genuine mobile — maxTouchPoints fires on most Windows 11
    // touchscreen laptops and would silently kill SSAO + shadows for desktop users.
    const mobile = /Mobi|Android/i.test(navigator.userAgent);
    const lowCPU = typeof navigator.hardwareConcurrency === "number" && navigator.hardwareConcurrency <= 2;
    return mobile || lowCPU;
  }, []);
}

export type ViewerStatus = "loading" | "ready" | "error";

// ── Viewer-side prop rendering (no selection, no transform controls) ──────────
interface PlacedPropDef {
  id: string;
  modelUrl: string;
  position: [number, number, number];
  rotation: [number, number, number];
  scale: [number, number, number];
}

function ViewerProp({ modelUrl, position, rotation, scale }: Omit<PlacedPropDef, "id">) {
  const { scene } = useGLTF(modelUrl);
  const clone = useMemo(() => {
    const c = scene.clone(true);
    c.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh) {
        const mesh = obj as THREE.Mesh;
        if (Array.isArray(mesh.material)) {
          mesh.material = mesh.material.map(m => m.clone());
        } else if (mesh.material) {
          mesh.material = (mesh.material as THREE.Material).clone();
        }
        mesh.castShadow = true;
        mesh.receiveShadow = true;
      }
    });
    return c;
  }, [scene]);
  return (
    <primitive
      object={clone}
      position={position}
      rotation={rotation}
      scale={scale}
    />
  );
}

class PropErrorBoundary extends Component<
  { children: React.ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: Error) {
    console.warn("[ViewerProp] failed to load prop:", error.message);
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

// Wraps the Canvas so WebGL context-loss crashes don't propagate to the
// parent (ConfiguratorClient), which would reset download progress state.
// Auto-retries up to 3 times after 1.5 s to recover once the context is restored.
class CanvasErrorBoundary extends Component<
  { children: React.ReactNode; onError?: (e: Error) => void },
  { error: Error | null; retryKey: number; retryCount: number }
> {
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  state = { error: null, retryKey: 0, retryCount: 0 };

  // getDerivedStateFromError is required — without it React tries to render the
  // broken subtree synchronously before componentDidCatch fires, and the error
  // escapes the boundary (shows Next.js error page instead of our fallback).
  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error) {
    console.warn("[R3FViewer] Canvas error:", error.message);
    this.props.onError?.(error);
    if (this.state.retryCount >= 3) return; // give up after 3 retries
    this.retryTimer = setTimeout(() => {
      this.setState(s => ({ error: null, retryKey: s.retryKey + 1, retryCount: s.retryCount + 1 }));
    }, 1500);
  }

  componentWillUnmount() {
    if (this.retryTimer) clearTimeout(this.retryTimer);
  }

  render() {
    if (this.state.error) {
      if (this.state.retryCount >= 3) {
        return (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-950">
            <p className="text-white/40 text-xs tracking-wide">Failed to initialize renderer. Please refresh.</p>
          </div>
        );
      }
      return (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-950">
          <div className="flex flex-col items-center gap-2">
            <div className="w-5 h-5 border-2 border-white/20 border-t-white/50 rounded-full animate-spin" />
            <p className="text-white/25 text-[10px] tracking-widest uppercase">Reconnecting…</p>
          </div>
        </div>
      );
    }
    return <React.Fragment key={this.state.retryKey}>{this.props.children}</React.Fragment>;
  }
}

function makeViewerShapeGeo(type: ShapeType): THREE.BufferGeometry {
  switch (type) {
    case "box":      return new THREE.BoxGeometry(1, 1, 1);
    case "sphere":   return new THREE.SphereGeometry(0.5, 32, 16);
    case "plane":    return new THREE.PlaneGeometry(1, 1);
    case "cylinder": return new THREE.CylinderGeometry(0.5, 0.5, 1, 32);
    case "cone":     return new THREE.ConeGeometry(0.5, 1, 32);
    case "torus":    return new THREE.TorusGeometry(0.4, 0.15, 16, 48);
  }
}

function ViewerShape({ shape, selectedOptions, allOptionNodes }: {
  shape: PlacedShapeData;
  selectedOptions?: string[];
  allOptionNodes?: string[];
}) {
  const geo = useMemo(() => makeViewerShapeGeo(shape.shapeType), [shape.shapeType]);
  const mat = useMemo(() => new THREE.MeshPhysicalMaterial({
    color: shape.color,
    roughness: shape.roughness,
    metalness: shape.metalness,
    opacity: shape.opacity,
    transparent: shape.opacity < 1,
    wireframe: shape.wireframe ?? false,
  }), [shape.color, shape.roughness, shape.metalness, shape.opacity, shape.wireframe]);

  // Mirror the same visibility logic as HomeModel's Pass 3: if the shape's name
  // is in allOptionNodes, it's only visible when also in selectedOptions.
  const optionsSeeded = (selectedOptions !== undefined) && (allOptionNodes !== undefined) &&
    selectedOptions.length + allOptionNodes.length > 0;
  const visible = !optionsSeeded ||
    !allOptionNodes!.includes(shape.name) ||
    selectedOptions!.includes(shape.name);

  return (
    <mesh
      name={shape.name}
      geometry={geo}
      material={mat}
      position={shape.position}
      rotation={shape.rotation}
      scale={shape.scale}
      visible={visible}
      castShadow
      receiveShadow
    />
  );
}

interface R3FViewerProps {
  modelUrl: string;
  currentPhase: PhaseId;
  currentLevel: LevelId;
  selectedOptions?: string[];
  allOptionNodes?: string[];
  nodeGroups?: ModelNodeGroups;
  selectedOptionObjects?: Record<string, Option>;
  materialLibrary?: MaterialLibraryEntry[];
  meshBaseMatMap?: Record<string, string>;
  glbMatOverrides?: Record<string, { base_color: string; roughness: number; metalness: number; properties?: MaterialLibraryEntry["properties"] }>;
  structuralArrays?: StructuralNodeArrays;
  placedProps?: PlacedPropDef[];
  placedShapes?: PlacedShapeData[];
  placedLights?: PlacedLight[];
  envPreset?: string;
  sceneSettings?: SceneRenderSettings;
  initialCamera?: CameraCoords;
  onApiReady?: (api: SketchfabCameraApi) => void;
  onStatusChange?: (status: ViewerStatus) => void;
  lowPerf?: boolean;
}

function LoadingFallback() {
  return (
    <mesh>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial color="#1e293b" />
    </mesh>
  );
}

function ErrorBoundaryFallback({ error }: { error: Error }) {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-black/70">
      <p className="text-sm text-red-400">Failed to load 3D model: {error.message}</p>
    </div>
  );
}

export default function R3FViewer({
  modelUrl,
  currentPhase,
  currentLevel,
  selectedOptions = [],
  allOptionNodes = [],
  nodeGroups,
  selectedOptionObjects,
  materialLibrary = [],
  meshBaseMatMap = {},
  glbMatOverrides = {},
  structuralArrays = {},
  placedProps = [],
  placedShapes = [],
  placedLights = [],
  envPreset = "apartment",
  sceneSettings,
  initialCamera,
  onApiReady,
  onStatusChange,
  lowPerf: lowPerfProp,
}: R3FViewerProps) {
  const autoLowPerf = useAutoLowPerf();
  const lowPerf = lowPerfProp ?? autoLowPerf;
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const modelLoadedRef = useRef(false);

  const [ptStatus, setPtStatus] = useState<PTStatus>({ state: "off", samples: 0 });
  const ptActive = ptStatus.state === "rendering" || ptStatus.state === "done";

  // Increment whenever scene composition changes so the path tracer rebuilds its BVH
  const [sceneVersion, setSceneVersion] = useState(0);
  const prevSceneKeyRef = useRef("");
  useEffect(() => {
    const key = JSON.stringify(selectedOptions) + JSON.stringify(glbMatOverrides);
    if (key !== prevSceneKeyRef.current) {
      prevSceneKeyRef.current = key;
      setSceneVersion(v => v + 1);
    }
  }, [selectedOptions, glbMatOverrides]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    // If the model already reported ready (React Strict Mode second pass where HomeModel
    // called onSceneReady in the first pass), re-signal ready instead of resetting to loading.
    if (modelLoadedRef.current) {
      setReady(true);
      onStatusChange?.("ready");
      return;
    }
    onStatusChange?.("loading");
    setReady(false);
    setError(null);
    // Reset on cleanup so genuine modelUrl changes start from loading state.
    return () => { modelLoadedRef.current = false; };
  }, [modelUrl]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleSceneReady() {
    if (modelLoadedRef.current) return;
    modelLoadedRef.current = true;
    setReady(true);
    onStatusChange?.("ready");
  }

  function handleApiReady(api: SketchfabCameraApi) {
    onApiReady?.(api);
  }

  if (error) return <ErrorBoundaryFallback error={error} />;

  function handleCanvasError() {
    modelLoadedRef.current = false;
    setReady(false);
    onStatusChange?.("loading");
  }

  return (
    <div className="relative w-full h-full bg-slate-950">
      {!ready && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-slate-950">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-2 border-white/20 border-t-white/70 rounded-full animate-spin" />
            <p className="text-white/30 text-xs tracking-widest uppercase">Loading model…</p>
          </div>
        </div>
      )}

      {/* Path tracing status indicator */}
      {(sceneSettings?.pathTracing) && ptStatus.state !== "off" && (
        <div className="absolute bottom-3 right-3 z-20 flex items-center gap-1.5 px-2 py-1 rounded-lg bg-black/50 backdrop-blur-sm border border-white/10 pointer-events-none select-none">
          {ptStatus.state === "building"  && <><span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" /><span className="text-[9px] text-white/40 tracking-wider">Building… {ptStatus.samples > 0 ? `${ptStatus.samples}%` : ""}</span></>}
          {ptStatus.state === "waiting"   && <><span className="w-1.5 h-1.5 rounded-full bg-white/25" /><span className="text-[9px] text-white/25 tracking-wider">PT ready</span></>}
          {ptStatus.state === "rendering" && <><span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /><span className="text-[9px] text-emerald-300/70 tabular-nums tracking-wider">PT {ptStatus.samples}</span></>}
          {ptStatus.state === "done"      && <><span className="w-1.5 h-1.5 rounded-full bg-emerald-400" /><span className="text-[9px] text-emerald-300/70 tracking-wider">PT ✓</span></>}
          {ptStatus.state === "error"     && <><span className="w-1.5 h-1.5 rounded-full bg-red-400" /><span className="text-[9px] text-red-400/70 tracking-wider">PT failed</span></>}
        </div>
      )}

      <CanvasErrorBoundary onError={handleCanvasError}>
      <Canvas
        shadows={(sceneSettings?.shadows ?? true) && !lowPerf ? "soft" : false}
        dpr={lowPerf ? 1 : [1, 2]}
        camera={{ position: [8, 6, 12], fov: sceneSettings?.cameraFov ?? 45 }}
        gl={{
          antialias: !lowPerf,
          alpha: false,
          toneMapping: ACESFilmicToneMapping,
          toneMappingExposure: 1.1,
          outputColorSpace: SRGBColorSpace,
          powerPreference: "high-performance",
        }}
        onCreated={({ gl }) => {
          gl.setClearColor("#0d0d0d", 1);

          // postprocessing's EffectComposer.addPass calls
          // renderer.getContext().getContextAttributes().alpha without a null check.
          // On context loss (can happen during heavy GLB parsing) that crashes the
          // entire React tree. Patch getContextAttributes to return the last-known
          // good attributes instead of null so the crash never occurs.
          const ctx = gl.getContext() as WebGLRenderingContext | WebGL2RenderingContext | null;
          if (ctx) {
            const orig = ctx.getContextAttributes.bind(ctx);
            let lastGood: WebGLContextAttributes | null = null;
            ctx.getContextAttributes = () => {
              const attrs = orig();
              if (attrs !== null) lastGood = attrs;
              return attrs ?? lastGood ?? { alpha: false };
            };
          }
        }}
      >
        <Suspense fallback={<LoadingFallback />}>
          <HomeModel
            modelUrl={modelUrl}
            currentPhase={currentPhase}
            currentLevel={currentLevel}
            selectedOptions={selectedOptions}
            allOptionNodes={allOptionNodes}
            nodeGroups={nodeGroups}
            selectedOptionObjects={selectedOptionObjects}
            materialLibrary={materialLibrary}
            meshBaseMatMap={meshBaseMatMap}
            glbMatOverrides={glbMatOverrides}
            structuralArrays={structuralArrays}
            onSceneReady={handleSceneReady}
          />
        </Suspense>

        {placedProps.map((p) => (
          <PropErrorBoundary key={p.id}>
            <Suspense fallback={null}>
              <ViewerProp
                modelUrl={p.modelUrl}
                position={p.position}
                rotation={p.rotation}
                scale={p.scale}
              />
            </Suspense>
          </PropErrorBoundary>
        ))}

        {placedShapes.map((sh) => (
          <ViewerShape
            key={sh.id}
            shape={sh}
            selectedOptions={selectedOptions}
            allOptionNodes={allOptionNodes}
          />
        ))}

        {placedLights.map((light) => (
          <group key={light.id} position={light.position}>
            {light.type === "point" ? (
              <pointLight
                color={light.color}
                intensity={light.intensity}
                distance={light.distance}
                decay={light.decay}
                castShadow={light.castShadow}
              />
            ) : (
              <spotLight
                color={light.color}
                intensity={light.intensity}
                distance={light.distance}
                decay={light.decay}
                castShadow={light.castShadow}
                angle={light.angle ?? Math.PI / 6}
                penumbra={light.penumbra ?? 0.2}
              />
            )}
          </group>
        ))}

        <CameraRig
          initialCamera={initialCamera}
          settings={sceneSettings}
          onApiReady={handleApiReady}
        />

        <EnvironmentSetup
          preset={envPreset}
          settings={sceneSettings}
          lowPerf={lowPerf}
          skipEffects={ptActive}
        />

        <PathTracerController
          enabled={sceneSettings?.pathTracing ?? false}
          bounces={sceneSettings?.pathTracingBounces ?? 4}
          sceneVersion={sceneVersion}
          onStatus={setPtStatus}
        />
      </Canvas>
      </CanvasErrorBoundary>
    </div>
  );
}
