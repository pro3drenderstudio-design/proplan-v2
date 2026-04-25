"use client";

import React, {
  Suspense, useEffect, useRef, useState,
  forwardRef, useImperativeHandle, Component,
} from "react";

class PropErrorBoundary extends Component<{ children: React.ReactNode }, { failed: boolean; error?: Error }> {
  state = { failed: false, error: undefined };
  static getDerivedStateFromError(error: Error) { return { failed: true, error }; }
  componentDidCatch(error: Error) { console.error("[PropErrorBoundary] prop load failed:", error.message); }
  render() { return this.state.failed ? null : this.props.children; }
}
import { Canvas, useThree, useFrame, useLoader } from "@react-three/fiber";
import type { ThreeEvent } from "@react-three/fiber";
import {
  useGLTF, OrbitControls, TransformControls,
  GizmoHelper, GizmoViewport, Environment,
  Grid, Sky, Stars, Cloud, Clouds, Html, useProgress,
} from "@react-three/drei";
import { GLTFLoader, DRACOLoader } from "three-stdlib";
import type { GLTF } from "three-stdlib";

useGLTF.setDecoderPath("https://www.gstatic.com/draco/versioned/decoders/1.5.5/");

// Explicit DRACOLoader wired directly to GLTFLoader — same pattern as Three.js docs
const _dracoLoader = new DRACOLoader();
_dracoLoader.setDecoderPath("https://www.gstatic.com/draco/versioned/decoders/1.5.5/");
_dracoLoader.preload();
function useGLTFDraco(url: string): GLTF {
  return useLoader(GLTFLoader, url, (loader) => {
    (loader as GLTFLoader).setDRACOLoader(_dracoLoader);
  }) as unknown as GLTF;
}
import { EffectComposer, Bloom, SMAA, N8AO, BrightnessContrast } from "@react-three/postprocessing";
import { BlendFunction } from "postprocessing";
import * as THREE from "three";
import { ACESFilmicToneMapping, SRGBColorSpace } from "three";
import { buildSceneTree, type SceneTreeNode } from "@/lib/three/variant-engine";
import { patchPolyhavenLoader } from "@/lib/three/polyhaven-loader";
import type { CameraCoords } from "@/utils/sketchfab-camera";

patchPolyhavenLoader();
import { exportCanvas } from "@/lib/three/canvas-export";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import type { MaterialLibraryEntry, MaterialProperties, PlacedLight, PlacedShapeData, ShapeType, ProjectAddon, AnnotationPin } from "@/types/database";
import PathTracerController, { PTStatus } from "@/components/r3f/PathTracerController";

// ─── Public types ─────────────────────────────────────────────────────────────

export interface SceneSettings {
  envLightType: "preset" | "hdri" | "none";
  envLightPreset: string;
  envLightHdriUrl: string;
  hdriIntensity: number;            // environmentIntensity — IBL/reflection brightness
  hdriBackgroundBrightness: number; // backgroundIntensity — background image brightness
  hdriRotation: number;             // degrees 0–360, applied to both env and bg
  hdriContrast: number;             // -1…1 via BrightnessContrast effect
  bgType: "env" | "color" | "sky";
  bgColor: string;
  ambientIntensity: number;
  sunIntensity: number;
  sunColor: string;          // hex, default warm white
  sunElevationDeg: number;   // 0–90
  sunAzimuthDeg: number;     // 0–360
  sunDistance: number;       // 1–100
  shadows: boolean;
  shadowRadius: number;    // PCF blur kernel — 1 = sharp, 8 = very soft
  skyDomeLights: boolean;       // 4 shadow-casting sky lights to simulate overcast diffuse shadows
  skyDomeLightIntensity: number; // per-light intensity
  skyDomeLightColor: string;     // hex tint for sky dome lights
  skyDomeLightShadows: boolean;  // whether dome lights cast shadows (expensive — 4 shadow maps)
  ssao: boolean;
  bloom: boolean;
  groundPlane: boolean;
  groundColor: string;
  groundSize: number;
  showGrid: boolean;
  // Sky background
  skyPreset: string;
  skyTurbidity: number;
  skyRayleigh: number;
  skyMieCoeff: number;
  skyMieDirectionalG: number;
  skyRotation: number;
  skyBrightness: number;
  showStars: boolean;
  // Clouds (sky mode only)
  showClouds: boolean;
  cloudOpacity: number;   // 0–1
  cloudSpeed: number;     // animation speed 0–2
  cloudColor: string;     // hex tint
  cloudHeight: number;    // world-space Y position
  cloudCount: number;     // 1–8 cloud formations
  // Atmospheric fog
  fogEnabled: boolean;
  fogColor: string;
  fogNear: number;
  fogFar: number;
  // AO quality
  aoRadius: number;
  aoSamples: number;
  aoIntensity: number;
  // Anti-aliasing
  aaMode: "none" | "smaa";
  // Path tracing (progressive GI when idle)
  pathTracing: boolean;
  pathTracingBounces: number;
  // Structural visibility — explicit mesh name arrays per role
  roofNodes: string[];
  level1Nodes: string[];
  level2Nodes: string[];
  level3Nodes: string[];
  // Camera controls
  cameraFov: number;
  architecturalMode: boolean;  // two-point perspective: locks camera level, verticals stay straight
  rotateSpeed: number;
  panSpeed: number;
  zoomSpeed: number;
  screenSpacePanning: boolean; // false = pan in world XY (better for arch viz)
  // Buyer-facing messaging
  welcomeMessage?: string;
  exteriorMessage?: string;
  interiorMessage?: string;
}

export const DEFAULT_SCENE_SETTINGS: SceneSettings = {
  envLightType: "preset",
  envLightPreset: "apartment",
  envLightHdriUrl: "",
  hdriIntensity: 1,
  hdriBackgroundBrightness: 1,
  hdriRotation: 0,
  hdriContrast: 0,
  bgType: "color",
  bgColor: "#0d0d0d",
  ambientIntensity: 0.4,
  sunIntensity: 2.2,
  sunColor: "#fff4e0",
  sunElevationDeg: 42,
  sunAzimuthDeg: 45,
  sunDistance: 18,
  shadows: true,
  shadowRadius: 3,
  skyDomeLights: true,
  skyDomeLightIntensity: 0.5,
  skyDomeLightColor: "#e8f0fa",
  skyDomeLightShadows: false,
  ssao: true,
  bloom: true,
  groundPlane: false,
  groundColor: "#2a2a2a",
  groundSize: 40,
  showGrid: true,
  skyPreset: "noon",
  skyTurbidity: 4.5,
  skyRayleigh: 2.5,
  skyMieCoeff: 0.003,
  skyMieDirectionalG: 0.92,
  skyRotation: 0,
  skyBrightness: 1,
  showStars: false,
  showClouds: false,
  cloudOpacity: 0.6,
  cloudSpeed: 0.2,
  cloudColor: "#ffffff",
  cloudHeight: 60,
  cloudCount: 5,
  fogEnabled: false,
  fogColor: "#b8d0e8",
  fogNear: 40,
  fogFar: 200,
  aoRadius: 3,
  aoSamples: 16,
  aoIntensity: 5,
  aaMode: "smaa",
  pathTracing: false,
  pathTracingBounces: 4,
  roofNodes: [],
  level1Nodes: [],
  level2Nodes: [],
  level3Nodes: [],
  cameraFov: 45,
  architecturalMode: false,
  rotateSpeed: 1.0,
  panSpeed: 1.0,
  zoomSpeed: 1.0,
  screenSpacePanning: true,
};

export type TransformMode = "translate" | "rotate" | "scale";

export type MeshOverrides = Record<string, {
  position?: [number, number, number];
  rotation?: [number, number, number];
  scale?: [number, number, number];
}>;

export interface SceneEditorViewportHandle {
  getCameraCoords(): CameraCoords | null;
  takeScreenshot(): string;
  getGlbMaterials(): GlbMaterialInfo[];
  flyTo(coords: CameraCoords): void;
}

// Mesh name → triangle count (base model + all addons)
export type MeshTriangleCounts = Record<string, number>;

export interface GlbMaterialInfo {
  name: string;
  color: string;       // hex
  roughness: number;
  metalness: number;
  usedByMeshes: string[];
  // Embedded texture presence (GLB binary textures — no URL, inherit in viewport)
  hasMap: boolean;
  hasNormalMap: boolean;
  hasBumpMap: boolean;
  hasRoughnessMap: boolean;
  hasMetalnessMap: boolean;
  hasAoMap: boolean;
}

// Full material definition passed from page to viewport for live preview
export interface MeshMaterialDef {
  color: string;
  roughness: number;
  metalness: number;
  properties?: MaterialProperties;
  // When set, the viewport clones the original GLB material by name (preserves embedded textures)
  glbMatName?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function sunToXYZ(elev: number, azim: number, dist: number): [number, number, number] {
  const e = (elev * Math.PI) / 180;
  const a = (azim * Math.PI) / 180;
  return [
    dist * Math.cos(e) * Math.sin(a),
    dist * Math.sin(e),
    dist * Math.cos(e) * Math.cos(a),
  ];
}

// ─── Highlight / isolation materials ──────────────────────────────────────────

// Inverted-hull outline — back-face mesh extruded outward in clip space so
// the outline pokes out from behind the front faces without covering the material.
const OUTLINE_VERT = /* glsl */`
uniform float uThickness;
void main() {
  vec4 clip = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  vec3 n    = normalize((projectionMatrix * modelViewMatrix * vec4(normal, 0.0)).xyz);
  clip.xy  += n.xy * clip.w * uThickness;
  gl_Position = clip;
}`;
const OUTLINE_FRAG = /* glsl */`
uniform vec3 uColor;
void main() { gl_FragColor = vec4(uColor, 1.0); }
`;
function makeOutlineMat(color: string) {
  return new THREE.ShaderMaterial({
    vertexShader:   OUTLINE_VERT,
    fragmentShader: OUTLINE_FRAG,
    uniforms: {
      uThickness: { value: 0.02 },
      uColor:     { value: new THREE.Color(color) },
    },
    side: THREE.BackSide,
  });
}
const OUTLINE_MAT_PRIMARY   = makeOutlineMat("#60a5fa"); // blue-400 — last selected
const OUTLINE_MAT_SECONDARY = makeOutlineMat("#3b82f6"); // blue-500 — rest of selection

const DIM_MAT = new THREE.MeshStandardMaterial({
  color: new THREE.Color("#111111"),
  transparent: true,
  opacity: 0.12,
  depthWrite: false,
});

// Teal highlight for meshes in the active option during paint mode
const PAINT_OPTION_MAT = new THREE.MeshStandardMaterial({
  color: new THREE.Color("#0d9488"),
  emissive: new THREE.Color("#0f766e"),
  emissiveIntensity: 0.3,
  transparent: true,
  opacity: 0.85,
});

// Brighter teal for meshes that are both in the active option AND selected
const PAINT_SELECTED_MAT = new THREE.MeshStandardMaterial({
  color: new THREE.Color("#10b981"),
  emissive: new THREE.Color("#059669"),
  emissiveIntensity: 0.5,
  transparent: true,
  opacity: 0.95,
});

// ─── Inner scene (must live inside Canvas) ────────────────────────────────────

interface EditorSceneProps {
  modelUrl: string;
  selectedMeshNames: string[];
  onMeshSelect: (names: string[]) => void;
  onSceneLoaded: (tree: SceneTreeNode[]) => void;
  transformMode: TransformMode | "none";
  sceneSettings: SceneSettings;
  meshOverrides: MeshOverrides;
  onMeshTransformStart?: () => void;
  onMeshTransformed: (name: string, pos: [number,number,number], rot: [number,number,number], sc: [number,number,number]) => void;
  placedProps: { id: string; modelUrl: string; position: [number,number,number]; rotation: [number,number,number]; scale: [number,number,number] }[];
  placedShapes?: PlacedShapeData[];
  selectedShapeId?: string | null;
  onShapeSelect?: (id: string | null) => void;
  onShapeTransformed?: (id: string, pos: [number,number,number], rot: [number,number,number], sc: [number,number,number]) => void;
  shapeTransformMode?: "translate" | "rotate" | "scale";
  shapeMaterials?: MaterialLibraryEntry[];
  isolationMeshes?: string[];
  paintHighlightMeshes?: string[];
  meshMaterials?: Record<string, MeshMaterialDef>;
  cameraCaptureRef: React.MutableRefObject<(() => CameraCoords | null) | null>;
  screenshotRef: React.MutableRefObject<(() => string) | null>;
  flyToRef: React.MutableRefObject<((coords: CameraCoords) => void) | null>;
  onGlbMats: (mats: GlbMaterialInfo[]) => void;
  hiddenLayers?: Set<string>;
  deletedMeshes?: Set<string>;
  // Ghost prop placement
  placingPropUrl?: string | null;
  placingPropScale?: [number, number, number];
  onPropPlaced?: (pos: [number,number,number]) => void;
  // Prop selection & transform
  selectedPropId?: string | null;
  onPropSelect?: (id: string | null) => void;
  onPropTransformed?: (id: string, pos: [number,number,number], rot: [number,number,number], sc: [number,number,number]) => void;
  propTransformMode?: "translate" | "rotate" | "scale";
  // Placed lights
  placedLights?: PlacedLight[];
  placingLightType?: "point" | "spot" | null;
  onLightPlaced?: (pos: [number,number,number]) => void;
  selectedLightId?: string | null;
  onLightSelect?: (id: string | null) => void;
  onLightTransformed?: (id: string, pos: [number,number,number]) => void;
  // Double-click mesh → open material
  onMeshDoubleClick?: (name: string) => void;
  // Suppress postprocessing while path tracer is rendering
  skipEffects?: boolean;
  // Addon GLBs — injected directly into clonedScene
  addons?: ProjectAddon[];
  onAddonTransformed?: (id: string, pos: [number,number,number], rot: [number,number,number], sc: [number,number,number]) => void;
  onAddonMeshNames?: (addonId: string, names: string[]) => void;
  // Scene tree update (fired when addons load/unload — no camera fit or health check)
  onSceneTreeUpdate?: (tree: SceneTreeNode[]) => void;
  // Triangle counts callback (fired after scene clone)
  onTriangleCounts?: (counts: MeshTriangleCounts) => void;
  // Annotation pins
  annotations?: AnnotationPin[];
  placingAnnotation?: boolean;
  onAnnotationPlaced?: (pos: [number,number,number]) => void;
}

function EditorScene({
  modelUrl, selectedMeshNames, onMeshSelect, onSceneLoaded,
  transformMode, sceneSettings: s, meshOverrides, onMeshTransformStart, onMeshTransformed,
  placedProps, placedShapes, selectedShapeId, onShapeSelect, onShapeTransformed, shapeTransformMode, shapeMaterials,
  isolationMeshes, paintHighlightMeshes, meshMaterials,
  cameraCaptureRef, screenshotRef, flyToRef, onGlbMats,
  hiddenLayers, deletedMeshes,
  placingPropUrl, placingPropScale, onPropPlaced,
  selectedPropId, onPropSelect, onPropTransformed, propTransformMode,
  placedLights = [], placingLightType, onLightPlaced,
  selectedLightId, onLightSelect, onLightTransformed,
  onMeshDoubleClick,
  skipEffects = false,
  addons = [], onAddonTransformed, onAddonMeshNames, onSceneTreeUpdate, onTriangleCounts,
  annotations = [], placingAnnotation = false, onAnnotationPlaced,
}: EditorSceneProps) {
  const { scene } = useGLTFDraco(modelUrl);
  const { camera, gl } = useThree();
  const orbitRef     = useRef<OrbitControlsImpl>(null);
  const reportedRef  = useRef(false);
  const isDragging   = useRef(false);

  // Reset drag flag whenever the mouse is released anywhere — prevents the flag
  // getting stuck when the mouse is released outside the canvas during a transform.
  useEffect(() => {
    const reset = () => { isDragging.current = false; };
    window.addEventListener("mouseup", reset);
    return () => window.removeEventListener("mouseup", reset);
  }, []);

  const originalMats       = useRef(new Map<string, THREE.Material | THREE.Material[]>());
  const originalTransforms = useRef(new Map<string, { pos: THREE.Vector3; rot: THREE.Euler; scale: THREE.Vector3 }>());
  const flyAnim = useRef<{
    active: boolean;
    startPos: THREE.Vector3;
    startTarget: THREE.Vector3;
    endPos: THREE.Vector3;
    endTarget: THREE.Vector3;
    t: number;
  } | null>(null);

  const [clonedScene, setClonedScene] = useState<THREE.Group | null>(null);
  const [sceneVersion, setSceneVersion] = useState(0);

  useFrame(({ gl: frameGl }) => {
    frameGl.toneMappingExposure = s.bgType === "sky" ? (s.skyBrightness ?? 1) : 1.15;
  });

  // Ghost prop placement state
  const [ghostPos, setGhostPos] = useState<[number,number,number] | null>(null);
  const groundPlaneRef = useRef(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0));
  const raycasterRef   = useRef(new THREE.Raycaster());

  // Texture loader + cache (url → Texture | "loading" | "failed")
  const texLoaderRef   = useRef(new THREE.TextureLoader());
  const texCacheRef    = useRef(new Map<string, THREE.Texture | "loading" | "failed">());
  const [texVersion, setTexVersion] = useState(0);
  // Cache of MeshPhysicalMaterial instances for override meshes
  const overrideMatsRef = useRef(new Map<string, THREE.MeshPhysicalMaterial>());
  // GLB material name → cloned original material (for glbMatName-based overrides)
  const glbMatsByName = useRef(new Map<string, THREE.Material>());

  // srgb=true for color maps (albedo, emissive); false for data maps (normal, bump, roughness, etc.)
  function loadTex(url: string | null | undefined, srgb = false): THREE.Texture | null {
    if (!url) return null;
    const key = srgb ? `${url}:srgb` : url;
    const cached = texCacheRef.current.get(key);
    if (cached instanceof THREE.Texture) return cached;
    if (cached === "loading" || cached === "failed") return null;
    texCacheRef.current.set(key, "loading");
    texLoaderRef.current.load(
      url,
      (tex) => {
        tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
        tex.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.LinearSRGBColorSpace;
        tex.needsUpdate = true;
        texCacheRef.current.set(key, tex);
        setTexVersion(v => v + 1);
      },
      undefined,
      () => texCacheRef.current.set(key, "failed"),
    );
    return null;
  }

  // Three.js r184 normal_fragment_maps uses #elif, so normal and bump are mutually exclusive by
  // default. This chunk replaces that include to apply normal map first, then layer bump on top.
  const COMBINED_NORMAL_BUMP = `
#ifdef USE_NORMALMAP_TANGENTSPACE
  vec3 mapN = texture2D( normalMap, vNormalMapUv ).xyz * 2.0 - 1.0;
  mapN.xy *= normalScale;
  normal = normalize( tbn * mapN );
  #ifdef USE_BUMPMAP
    normal = perturbNormalArb( - vViewPosition, normal, dHdxy_fwd(), faceDirection );
  #endif
#elif defined( USE_NORMALMAP_OBJECTSPACE )
  normal = texture2D( normalMap, vNormalMapUv ).xyz * 2.0 - 1.0;
  #ifdef FLIP_SIDED
    normal = - normal;
  #endif
  #ifdef DOUBLE_SIDED
    normal = normal * faceDirection;
  #endif
  normal = normalize( normalMatrix * normal );
#elif defined( USE_BUMPMAP )
  normal = perturbNormalArb( - vViewPosition, normal, dHdxy_fwd(), faceDirection );
#endif`;

  function applyUV(tex: THREE.Texture | null, p: MaterialProperties): THREE.Texture | null {
    if (!tex) return null;
    tex.repeat.set(p.uvRepeatX ?? 1, p.uvRepeatY ?? 1);
    tex.offset.set(p.uvOffsetX ?? 0, p.uvOffsetY ?? 0);
    tex.rotation = ((p.uvRotation ?? 0) * Math.PI) / 180;
    tex.needsUpdate = true;
    return tex;
  }

  // Injects world-space projection into a MeshPhysicalMaterial via onBeforeCompile.
  // Only replaces the diffuse (map) and roughness map sampling; normal/bump keep UV mode.
  function applyProjection(
    mat: THREE.MeshPhysicalMaterial,
    projection: string,
    scale: number,
    scaleX?: number,
    scaleY?: number,
    scaleZ?: number,
    offsetX?: number,
    offsetY?: number,
    offsetZ?: number,
    rotationDeg?: number,
  ) {
    const s  = scale.toFixed(6);
    // Per-axis world-space scales for triplanar. Fall back to unified scale when not set.
    const sx = (scaleX !== undefined ? 1 / Math.max(scaleX, 0.001) : scale).toFixed(6);
    const sy = (scaleY !== undefined ? 1 / Math.max(scaleY, 0.001) : scale).toFixed(6);
    const sz = (scaleZ !== undefined ? 1 / Math.max(scaleZ, 0.001) : scale).toFixed(6);
    const ox = (offsetX ?? 0).toFixed(6);
    const oy = (offsetY ?? 0).toFixed(6);
    const oz = (offsetZ ?? 0).toFixed(6);
    const rot = (((rotationDeg ?? 0) * Math.PI) / 180).toFixed(6);

    // Shared vertex additions — world position (and normal for triplanar)
    const vertDecl = `varying vec3 v_wPos; varying vec3 v_wNrm;`;
    const vertMain = `v_wPos=(modelMatrix*vec4(position,1.)).xyz; v_wNrm=normalize((modelMatrix*vec4(normal,0.)).xyz);`;

    let fragDecl: string;
    let mapReplace: string;

    if (projection === "triplanar") {
      // Each face uses the two world axes it can "see", with offset and rotation applied.
      // X-face (b.x): sees YZ → vec2((z+oz)*sz, (y+oy)*sy)
      // Y-face (b.y): sees XZ → vec2((x+ox)*sx, (z+oz)*sz)
      // Z-face (b.z): sees XY → vec2((x+ox)*sx, (y+oy)*sy)
      fragDecl = `
varying vec3 v_wPos; varying vec3 v_wNrm;
vec2 _r2(vec2 uv,float a){float c=cos(a),s=sin(a);return vec2(uv.x*c-uv.y*s,uv.x*s+uv.y*c);}
vec4 _tp(sampler2D t,float sx,float sy,float sz,float ox,float oy,float oz,float r){
  vec3 b=normalize(abs(v_wNrm)); b=max(b-.2,.001); b/=dot(b,vec3(1.));
  return texture2D(t,_r2(vec2((v_wPos.z+oz)*sz,(v_wPos.y+oy)*sy),r))*b.x
        +texture2D(t,_r2(vec2((v_wPos.x+ox)*sx,(v_wPos.z+oz)*sz),r))*b.y
        +texture2D(t,_r2(vec2((v_wPos.x+ox)*sx,(v_wPos.y+oy)*sy),r))*b.z;
}`;
      mapReplace = `#ifdef USE_MAP\n  diffuseColor*=_tp(map,${sx},${sy},${sz},${ox},${oy},${oz},${rot});\n#endif`;
    } else {
      // planar projections: top=xz, front=xy, side=yz
      const uv = projection === "planar-top" ? "v_wPos.xz"
               : projection === "planar-front" ? "v_wPos.xy"
               : "v_wPos.yz";
      fragDecl = `varying vec3 v_wPos;\nvec4 _pl(sampler2D t,float s){return texture2D(t,${uv}*s);}`;
      mapReplace = `#ifdef USE_MAP\n  diffuseColor*=_pl(map,${s});\n#endif`;
    }

    mat.onBeforeCompile = (shader) => {
      shader.vertexShader = shader.vertexShader
        .replace("#include <common>", `#include <common>\n${vertDecl}`)
        .replace("#include <worldpos_vertex>", `#include <worldpos_vertex>\n${vertMain}`);
      shader.fragmentShader = shader.fragmentShader
        .replace("#include <common>", `#include <common>\n${fragDecl}`)
        .replace("#include <map_fragment>", mapReplace);
    };
    mat.customProgramCacheKey = () => `${projection}@${s}@${sx}@${sy}@${sz}@${ox}@${oy}@${oz}@${rot}`;
    mat.needsUpdate = true;
  }

  function syncOverrideMat(meshName: string, def: MeshMaterialDef): THREE.Material {
    // GLB material swap — clone the original material from the GLB so embedded textures are preserved,
    // then apply any scalar/property overrides on top.
    if (def.glbMatName) {
      const src = glbMatsByName.current.get(def.glbMatName);
      if (src) {
        let entry = overrideMatsRef.current.get(meshName) as THREE.Material | undefined;
        if (!(entry as any)?.__glbSrc || (entry as any).__glbSrc !== def.glbMatName) {
          entry = src.clone();
          (entry as any).__glbSrc = def.glbMatName;
          overrideMatsRef.current.set(meshName, entry as THREE.MeshPhysicalMaterial);
        }
        // Apply scalar overrides on top of the cloned GLB material
        if (entry instanceof THREE.MeshStandardMaterial) {
          const p = def.properties ?? {};
          entry.roughness  = def.roughness;
          entry.metalness  = def.metalness;
          entry.opacity    = p.opacity ?? 1;
          entry.transparent = (p.opacity ?? 1) < 1 || ((entry as any).transmission ?? 0) > 0;
          entry.emissive?.set(p.emissiveColor ?? "#000000");
          entry.emissiveIntensity = p.emissiveIntensity ?? 0;
          entry.aoMapIntensity    = p.aoIntensity ?? 1;
          if (entry instanceof THREE.MeshPhysicalMaterial) {
            entry.ior              = p.ior ?? 1.5;
            entry.clearcoat        = p.clearcoat ?? 0;
            entry.clearcoatRoughness = p.clearcoatRoughness ?? 0;
            entry.transmission     = p.transmission ?? 0;
          }
          // Only tint the color if the user explicitly changed it from default white
          const defaultColor = "#ffffff";
          if (def.color && def.color !== defaultColor) {
            entry.color.set(def.color);
          }
          // Apply brightness multiplier (scales color channel which Three.js multiplies over the texture)
          const brightness = p.albedoBrightness ?? 1;
          if (brightness !== 1) entry.color.multiplyScalar(brightness);
          entry.needsUpdate = true;
        }
        return entry!;
      }
    }

    const p = def.properties ?? {};
    const projection = p.uvProjection ?? "uv";
    const worldScale = 1 / Math.max(p.uvScale ?? 1, 0.001);

    // Original GLB material for this mesh (texture inheritance)
    const origRaw = originalMats.current.get(meshName);
    const origMat = (() => {
      if (!origRaw) return null;
      const m = Array.isArray(origRaw) ? origRaw[0] : origRaw;
      return m instanceof THREE.MeshStandardMaterial ? m : null;
    })();

    // Override textures from properties (URL-based)
    const albedoOv = applyUV(loadTex(p.albedoMapUrl, true), p);
    const normalOv = applyUV(loadTex(p.normalMapUrl),       p);
    const bumpOv   = applyUV(loadTex(p.bumpMapUrl),         p);
    const roughOv  = applyUV(loadTex(p.roughnessMapUrl),    p);
    const metalOv  = applyUV(loadTex(p.metalnessMapUrl),    p);
    const aoOv     = applyUV(loadTex(p.aoMapUrl),           p);

    // Final textures: URL override takes priority, else inherit from GLB
    const albedoTex = albedoOv ?? origMat?.map          ?? null;
    const normalTex = normalOv ?? origMat?.normalMap     ?? null;
    const bumpTex   = bumpOv   ?? origMat?.bumpMap       ?? null;
    const roughTex  = roughOv  ?? origMat?.roughnessMap  ?? null;
    const metalTex  = metalOv  ?? origMat?.metalnessMap  ?? null;
    const aoTex     = aoOv     ?? origMat?.aoMap         ?? null;

    // Three.js bakes USE_NORMALMAP / USE_BUMPMAP etc. into the compiled shader at
    // creation time. If we add a texture to an already-compiled material, needsUpdate
    // alone may not force a recompile with the new defines. To guarantee correct
    // shader defines, we dispose + recreate whenever the presence of any texture slot
    // changes (null→texture or texture→null).
    // Include 'c' flag when both normal+bump are set so the combined-shader variant
    // gets its own program cache entry, distinct from normal-only or bump-only.
    const bothNB = !!(normalTex && bumpTex);
    const texKey = [albedoTex, normalTex, bumpTex, roughTex, metalTex, aoTex]
      .map(t => (t ? "1" : "0")).join("") + `|${projection}|${bothNB ? "c" : ""}`;

    let mat = overrideMatsRef.current.get(meshName);
    if (!mat || (mat as any).__texKey !== texKey) {
      mat?.dispose();
      mat = new THREE.MeshPhysicalMaterial();
      (mat as any).__texKey = texKey;
      overrideMatsRef.current.set(meshName, mat);
    }

    // ── Diffuse color ──────────────────────────────────────────────────────────
    if (albedoTex) {
      if (p.albedoMapUrl) {
        // User-supplied albedo URL: white base so texture shows true; tint with def.color if colorTint is on
        mat.color.set(p.colorTint ? def.color : "#ffffff");
      } else {
        // Inherited GLB texture: keep original material color so the GLB look is preserved
        mat.color.copy(origMat?.color ?? new THREE.Color("#ffffff"));
      }
      const brightness = p.albedoBrightness ?? 1;
      if (brightness !== 1) mat.color.multiplyScalar(brightness);
    } else {
      mat.color.set(def.color);
    }

    mat.roughness    = def.roughness;
    mat.metalness    = def.metalness;

    // ── Texture maps ──────────────────────────────────────────────────────────
    mat.map          = albedoTex;
    mat.normalMap    = normalTex;
    mat.normalScale.set(p.normalScale ?? 1, p.normalScale ?? 1);
    mat.bumpMap      = bumpTex;
    mat.bumpScale    = p.bumpScale ?? 0.05;
    mat.roughnessMap = roughTex;
    mat.metalnessMap = metalTex;
    mat.aoMap        = aoTex;
    mat.aoMapIntensity   = p.aoIntensity ?? 1;
    mat.emissive.set(p.emissiveColor ?? "#000000");
    mat.emissiveIntensity = p.emissiveIntensity ?? 0;
    mat.envMapIntensity  = 1.0;
    mat.opacity      = p.opacity ?? 1;
    mat.transparent  = (p.opacity ?? 1) < 1 || (p.transmission ?? 0) > 0;
    mat.ior          = p.ior ?? 1.5;
    mat.clearcoat    = p.clearcoat ?? 0;
    mat.clearcoatRoughness = p.clearcoatRoughness ?? 0;
    mat.transmission = p.transmission ?? 0;

    // ── Projection / normal+bump combination ─────────────────────────────────
    if (projection !== "uv" && mat.map) {
      applyProjection(mat, projection, worldScale, p.uvScaleX, p.uvScaleY, p.uvScaleZ, p.uvTriOffsetX, p.uvTriOffsetY, p.uvTriOffsetZ, p.uvTriRotation);
    } else if (bothNB) {
      // Both normal and bump set: inject combined shader so bump layers on top of normal.
      // Three.js default #elif makes them mutually exclusive; this replaces that chunk.
      mat.onBeforeCompile = (shader) => {
        shader.fragmentShader = shader.fragmentShader
          .replace("#include <normal_fragment_maps>", COMBINED_NORMAL_BUMP);
      };
      mat.customProgramCacheKey = () => "combined-nb";
    }

    mat.needsUpdate = true;
    return mat;
  }

  // Clone model once per URL, capture original mats + transforms, extract GLB materials, apply overrides
  useEffect(() => {
    const clone = scene.clone(true);
    originalMats.current.clear();
    originalTransforms.current.clear();

    const matMap = new Map<string, { mat: THREE.MeshStandardMaterial; meshes: string[] }>();

    clone.traverse((obj) => {
      if (!(obj instanceof THREE.Mesh)) return;
      // Enable shadows on every mesh in the GLB
      obj.castShadow    = true;
      obj.receiveShadow = true;
      if (obj.name) {
        originalMats.current.set(obj.name,
          Array.isArray(obj.material) ? obj.material.map(m => m.clone()) : obj.material.clone()
        );
        // Capture GLB-default transforms BEFORE applying any overrides
        originalTransforms.current.set(obj.name, {
          pos:   obj.position.clone(),
          rot:   obj.rotation.clone(),
          scale: obj.scale.clone(),
        });
      }
      // GLB material extraction
      const rawMat = Array.isArray(obj.material) ? obj.material[0] : obj.material;
      if (rawMat instanceof THREE.MeshStandardMaterial) {
        const key = rawMat.name || rawMat.uuid;
        if (!matMap.has(key)) matMap.set(key, { mat: rawMat, meshes: [] });
        if (obj.name) matMap.get(key)!.meshes.push(obj.name);
      }
      // Apply saved transforms
      const ov = meshOverrides[obj.name];
      if (ov) {
        if (ov.position) obj.position.set(...ov.position);
        if (ov.rotation) obj.rotation.set(...ov.rotation);
        if (ov.scale)    obj.scale.set(...ov.scale);
      }
    });

    // Build name → original material map (for glbMatName-based overrides)
    glbMatsByName.current.clear();
    for (const [, { mat }] of matMap) {
      if (mat.name) glbMatsByName.current.set(mat.name, mat);
    }

    const extracted: GlbMaterialInfo[] = [];
    for (const [, { mat, meshes }] of matMap) {
      if (meshes.length === 0) continue;
      extracted.push({
        name: mat.name || "Unnamed",
        color: "#" + mat.color.getHexString(),
        roughness: mat.roughness,
        metalness: mat.metalness,
        usedByMeshes: meshes,
        hasMap:          !!mat.map,
        hasNormalMap:    !!mat.normalMap,
        hasBumpMap:      !!mat.bumpMap,
        hasRoughnessMap: !!mat.roughnessMap,
        hasMetalnessMap: !!mat.metalnessMap,
        hasAoMap:        !!mat.aoMap,
      });
    }
    onGlbMats(extracted);

    // Triangle counts per mesh name
    if (onTriangleCounts) {
      const counts: MeshTriangleCounts = {};
      clone.traverse((obj) => {
        if (!(obj instanceof THREE.Mesh) || !obj.name) return;
        const geo = obj.geometry;
        if (!geo) return;
        counts[obj.name] = geo.index
          ? geo.index.count / 3
          : (geo.attributes.position?.count ?? 0) / 3;
      });
      onTriangleCounts(counts);
    }

    setClonedScene(clone);
    reportedRef.current = false;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modelUrl]);

  // Rebuild scene tree when addons inject/remove (no camera fit, no health check)
  useEffect(() => {
    if (!clonedScene || sceneVersion === 0) return;
    onSceneTreeUpdate?.(buildSceneTree(clonedScene).children);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sceneVersion]);

  // Report scene tree + fit camera once after clone is ready
  useEffect(() => {
    if (!clonedScene || reportedRef.current) return;
    reportedRef.current = true;
    onSceneLoaded(buildSceneTree(clonedScene).children);
    const box    = new THREE.Box3().setFromObject(clonedScene);
    const center = box.getCenter(new THREE.Vector3());
    const size   = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z) || 1;
    camera.position.set(center.x, center.y + maxDim * 0.5, center.z + maxDim * 1.5);
    if (orbitRef.current) {
      orbitRef.current.target.copy(center);
      orbitRef.current.update();
    }
  }, [clonedScene, camera, onSceneLoaded]);

  // Apply layer visibility — directly toggle structural layer meshes on/off
  useEffect(() => {
    if (!clonedScene) return;
    // Reset everything to visible first
    clonedScene.traverse((obj) => { obj.visible = true; });
    if (!hiddenLayers || hiddenLayers.size === 0) return;

    const layerMeshNames: Record<string, string[]> = {
      roof:   s.roofNodes   ?? [],
      level1: s.level1Nodes ?? [],
      level2: s.level2Nodes ?? [],
      level3: s.level3Nodes ?? [],
    };
    for (const layer of hiddenLayers) {
      for (const name of (layerMeshNames[layer] ?? [])) {
        clonedScene.traverse((obj) => {
          if (obj.name === name) obj.visible = false;
        });
      }
    }
  }, [clonedScene, hiddenLayers, s.roofNodes, s.level1Nodes, s.level2Nodes, s.level3Nodes]);

  // Apply highlight materials + isolation + paint mode + material overrides (incl. textures)
  useEffect(() => {
    if (!clonedScene) return;
    const primary      = selectedMeshNames.at(-1);
    const isolationSet = isolationMeshes ? new Set(isolationMeshes) : null;
    const paintSet     = paintHighlightMeshes ? new Set(paintHighlightMeshes) : null;

    // Dispose override mats for meshes no longer in the map
    for (const [name] of overrideMatsRef.current) {
      if (!meshMaterials?.[name]) { overrideMatsRef.current.get(name)!.dispose(); overrideMatsRef.current.delete(name); }
    }

    clonedScene.traverse((obj) => {
      if (!(obj instanceof THREE.Mesh) || !obj.name) return;
      if (obj.userData.selOutline) return; // skip inverted-hull outline children

      // Deleted meshes are invisible regardless of everything else
      if (deletedMeshes?.has(obj.name)) { obj.visible = false; return; }
      obj.visible = true;

      const inPaint    = paintSet?.has(obj.name) ?? false;
      const isPrimary  = obj.name === primary;
      const isSelected = selectedMeshNames.includes(obj.name);

      if ((isPrimary || isSelected) && inPaint) {
        obj.material = PAINT_SELECTED_MAT;
      } else if ((isPrimary || isSelected) && !inPaint) {
        // Outline postprocessing handles the highlight — show real material
        if (meshMaterials?.[obj.name]) {
          obj.material = syncOverrideMat(obj.name, meshMaterials[obj.name]);
        } else {
          const orig = originalMats.current.get(obj.name);
          if (orig) obj.material = orig as THREE.Material;
        }
      } else if (inPaint) {
        obj.material = PAINT_OPTION_MAT;
      } else if (isolationSet && !isolationSet.has(obj.name)) {
        obj.material = DIM_MAT;
      } else if (meshMaterials?.[obj.name]) {
        obj.material = syncOverrideMat(obj.name, meshMaterials[obj.name]);
      } else {
        const orig = originalMats.current.get(obj.name);
        if (orig) obj.material = orig as THREE.Material;
      }
    });
  // texVersion dep ensures re-apply when async textures finish loading
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clonedScene, selectedMeshNames, isolationMeshes, paintHighlightMeshes, meshMaterials, texVersion, deletedMeshes]);

  // Inverted-hull outline — add back-face child meshes to selected objects
  useEffect(() => {
    if (!clonedScene) return;
    const primary = selectedMeshNames.at(-1);

    // Remove any existing outline children
    const old: THREE.Mesh[] = [];
    clonedScene.traverse(o => { if (o instanceof THREE.Mesh && o.userData.selOutline) old.push(o); });
    old.forEach(o => o.parent?.remove(o));

    // Add new outline children
    clonedScene.traverse(o => {
      if (!(o instanceof THREE.Mesh) || !o.name || o.userData.selOutline) return;
      if (!selectedMeshNames.includes(o.name)) return;
      if (deletedMeshes?.has(o.name)) return;
      const hull = new THREE.Mesh(o.geometry, o.name === primary ? OUTLINE_MAT_PRIMARY : OUTLINE_MAT_SECONDARY);
      hull.userData.selOutline = true;
      hull.renderOrder = -1;
      o.add(hull);
    });

    return () => {
      const leftover: THREE.Mesh[] = [];
      clonedScene.traverse(o => { if (o instanceof THREE.Mesh && o.userData.selOutline) leftover.push(o); });
      leftover.forEach(o => o.parent?.remove(o));
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clonedScene, selectedMeshNames, deletedMeshes]);

  // Re-apply mesh transforms whenever meshOverrides changes (makes undo/redo work in 3D)
  useEffect(() => {
    if (!clonedScene) return;
    clonedScene.traverse((obj) => {
      if (!(obj instanceof THREE.Mesh) || !obj.name) return;
      const ov   = meshOverrides[obj.name];
      const orig = originalTransforms.current.get(obj.name);
      if (ov) {
        if (ov.position) obj.position.set(...ov.position);
        if (ov.rotation) obj.rotation.set(...ov.rotation);
        if (ov.scale)    obj.scale.set(...ov.scale);
      } else if (orig) {
        obj.position.copy(orig.pos);
        obj.rotation.copy(orig.rot);
        obj.scale.copy(orig.scale);
      }
    });
  }, [clonedScene, meshOverrides]);

  // Sync selectedObj (for TransformControls) from last in selection
  const primaryName = selectedMeshNames.at(-1) ?? null;
  const [selectedObj, setSelectedObj] = useState<THREE.Object3D | null>(null);
  useEffect(() => {
    if (!primaryName || !clonedScene) { setSelectedObj(null); return; }
    let found: THREE.Object3D | null = null;
    clonedScene.traverse((obj) => { if (!found && obj.name === primaryName) found = obj; });
    setSelectedObj(found);
  }, [primaryName, clonedScene]);

  // Expose camera capture + screenshot + flyTo
  useEffect(() => {
    cameraCaptureRef.current = () => {
      if (!orbitRef.current || !(camera instanceof THREE.PerspectiveCamera)) return null;
      const { position: pos } = camera;
      const target = orbitRef.current.target;
      return { pos: [pos.x, pos.y, pos.z], target: [target.x, target.y, target.z], fov: camera.fov };
    };
    screenshotRef.current = () => {
      gl.render(clonedScene ?? scene, camera);
      return exportCanvas(gl, { format: "jpeg", quality: 0.92 });
    };
    flyToRef.current = (coords: CameraCoords) => {
      if (!orbitRef.current) return;
      flyAnim.current = {
        active: true,
        startPos:    camera.position.clone(),
        startTarget: orbitRef.current.target.clone(),
        endPos:    new THREE.Vector3(...coords.pos),
        endTarget: new THREE.Vector3(...coords.target),
        t: 0,
      };
    };
  }, [camera, cameraCaptureRef, clonedScene, flyToRef, gl, scene, screenshotRef]);

  // Animate camera flyTo
  useFrame((_, delta) => {
    if (!flyAnim.current?.active || !orbitRef.current) return;
    flyAnim.current.t = Math.min(flyAnim.current.t + delta * 2.2, 1);
    const ease = 1 - Math.pow(1 - flyAnim.current.t, 3);
    camera.position.lerpVectors(flyAnim.current.startPos, flyAnim.current.endPos, ease);
    orbitRef.current.target.lerpVectors(flyAnim.current.startTarget, flyAnim.current.endTarget, ease);
    orbitRef.current.update();
    if (flyAnim.current.t >= 1) flyAnim.current.active = false;
  });

  // Sync camera FOV
  useEffect(() => {
    if (camera instanceof THREE.PerspectiveCamera) {
      camera.fov = s.cameraFov;
      camera.updateProjectionMatrix();
    }
  }, [camera, s.cameraFov]);

  function handleCanvasPointerMove(e: ThreeEvent<PointerEvent>) {
    if (!placingPropUrl && !placingLightType && !placingAnnotation) return;
    const hit = new THREE.Vector3();
    raycasterRef.current.setFromCamera(
      new THREE.Vector2(e.pointer.x, e.pointer.y),
      camera,
    );
    raycasterRef.current.ray.intersectPlane(groundPlaneRef.current, hit);
    setGhostPos([hit.x, hit.y, hit.z]);
  }

  function handleCanvasPointerDown(e: ThreeEvent<PointerEvent>) {
    if (placingAnnotation && ghostPos) {
      e.stopPropagation();
      onAnnotationPlaced?.(ghostPos);
      return;
    }
    if (placingLightType && ghostPos) {
      e.stopPropagation();
      onLightPlaced?.(ghostPos);
      return;
    }
    if (placingPropUrl && ghostPos) {
      e.stopPropagation();
      onPropPlaced?.(ghostPos);
      return;
    }
  }

  function handlePointerDown(e: ThreeEvent<PointerEvent>) {
    if (placingLightType) {
      // Place light on mesh surface at exact hit point
      e.stopPropagation();
      onLightPlaced?.([e.point.x, e.point.y, e.point.z]);
      return;
    }
    if (placingPropUrl) return;
    if (isDragging.current) return;
    e.stopPropagation();
    let obj: THREE.Object3D | null = e.object;
    if (!obj.visible) return;
    while (obj && !obj.name) obj = obj.parent;
    if (!obj?.name) return;
    const addMode = e.nativeEvent.ctrlKey || e.nativeEvent.metaKey;
    if (addMode) {
      onMeshSelect(
        selectedMeshNames.includes(obj.name)
          ? selectedMeshNames.filter(n => n !== obj.name)
          : [...selectedMeshNames, obj.name]
      );
    } else {
      onMeshSelect([obj.name]);
    }
  }

  function handlePointerDoubleClick(e: ThreeEvent<MouseEvent>) {
    if (placingPropUrl || placingLightType || isDragging.current) return;
    e.stopPropagation();
    let obj: THREE.Object3D | null = e.object;
    if (!obj.visible) return;
    while (obj && !obj.name) obj = obj.parent;
    if (!obj?.name) return;
    onMeshDoubleClick?.(obj.name);
  }

  function handleTransformChange() {
    if (!selectedObj) return;
    const p = selectedObj.position;
    const r = selectedObj.rotation;
    const sc = selectedObj.scale;
    if (selectedObj.userData?.addonId) {
      onAddonTransformed?.(selectedObj.userData.addonId, [p.x, p.y, p.z], [r.x, r.y, r.z], [sc.x, sc.y, sc.z]);
    } else {
      if (!selectedObj.name) return;
      onMeshTransformed(selectedObj.name, [p.x, p.y, p.z], [r.x, r.y, r.z], [sc.x, sc.y, sc.z]);
    }
  }

  const skyRotRad = ((s.skyRotation ?? 0) * Math.PI) / 180;
  const sunPos  = sunToXYZ(s.sunElevationDeg, s.sunAzimuthDeg + (s.skyRotation ?? 0), s.sunDistance);
  const envPreset = s.envLightPreset as Parameters<typeof Environment>[0]["preset"];

  // Sky sun position vector (for drei's Sky component)
  const skySunPos: [number, number, number] = (() => {
    const el  = (s.sunElevationDeg * Math.PI) / 180;
    const az  = (s.sunAzimuthDeg   * Math.PI) / 180 + skyRotRad;
    return [Math.cos(el) * Math.sin(az), Math.sin(el), Math.cos(el) * Math.cos(az)];
  })();

  return (
    <>
      {s.bgType === "color" && (
        <color attach="background" args={[s.bgColor]} />
      )}
      {s.bgType === "sky" && (
        <Sky
          distance={450000}
          sunPosition={skySunPos}
          turbidity={s.skyTurbidity}
          rayleigh={s.skyRayleigh}
          mieCoefficient={s.skyMieCoeff}
          mieDirectionalG={s.skyMieDirectionalG}
        />
      )}
      {s.bgType === "sky" && s.showStars && (
        <Stars radius={100} depth={50} count={5000} factor={4} saturation={0} fade speed={0.5} />
      )}
      {s.bgType === "sky" && s.showClouds && (
        <Clouds material={THREE.MeshLambertMaterial}>
          {Array.from({ length: s.cloudCount ?? 5 }).map((_, i) => (
            <Cloud
              key={i}
              seed={i + 1}
              position={[
                (i % 3 - 1) * 120,
                (s.cloudHeight ?? 60) + (i % 2) * 15,
                -60 - i * 40,
              ]}
              bounds={[80, 10, 80]}
              volume={70}
              segments={40}
              opacity={s.cloudOpacity ?? 0.6}
              speed={s.cloudSpeed ?? 0.2}
              color={s.cloudColor ?? "#ffffff"}
            />
          ))}
        </Clouds>
      )}
      {s.fogEnabled && (
        <fog attach="fog" args={[s.fogColor, s.fogNear, s.fogFar]} />
      )}

      <OrbitControls
        ref={orbitRef}
        makeDefault
        minDistance={0.5}
        maxDistance={500}
        enableDamping
        dampingFactor={0.08}
        rotateSpeed={s.rotateSpeed}
        panSpeed={s.panSpeed}
        zoomSpeed={s.zoomSpeed}
        screenSpacePanning={s.screenSpacePanning}
        minPolarAngle={s.architecturalMode ? Math.PI / 2 : 0}
        maxPolarAngle={s.architecturalMode ? Math.PI / 2 : Math.PI}
      />

      {selectedObj && transformMode !== "none" && (
        <TransformControls
          object={selectedObj}
          mode={transformMode}
          onMouseDown={() => { isDragging.current = true; onMeshTransformStart?.(); }}
          onMouseUp={() => { isDragging.current = false; }}
          onChange={handleTransformChange}
          size={0.85}
        />
      )}

      {clonedScene && (
        <primitive object={clonedScene} onPointerDown={handlePointerDown} onDoubleClick={handlePointerDoubleClick} />
      )}

      {placedProps.map((p) => (
        <PropErrorBoundary key={p.id}>
          <Suspense fallback={
            <group position={p.position}>
              <mesh>
                <sphereGeometry args={[0.15, 8, 8]} />
                <meshBasicMaterial color="#60a5fa" wireframe />
              </mesh>
              <Html center distanceFactor={8} style={{ pointerEvents: "none" }}>
                <div style={{ background: "rgba(0,0,0,0.7)", color: "#60a5fa", fontSize: 10, padding: "2px 7px", borderRadius: 4, whiteSpace: "nowrap", fontFamily: "monospace", letterSpacing: 1 }}>
                  ↓ loading…
                </div>
              </Html>
            </group>
          }>
            <PlacedProp
              {...p}
              isSelected={selectedPropId === p.id}
              transformMode={propTransformMode ?? "translate"}
              onSelect={() => !placingPropUrl && onPropSelect?.(p.id)}
              onTransformed={(pos, rot, sc) => onPropTransformed?.(p.id, pos, rot, sc)}
            />
          </Suspense>
        </PropErrorBoundary>
      ))}

      {(placedShapes ?? []).map((sh) => (
        <PlacedShape
          key={sh.id}
          shape={sh}
          isSelected={selectedShapeId === sh.id}
          transformMode={shapeTransformMode ?? "translate"}
          clonedScene={clonedScene}
          materials={shapeMaterials}
          onSelect={() => { onShapeSelect?.(sh.id); onPropSelect?.(null); onMeshSelect([]); }}
          onTransformed={(pos, rot, sc) => onShapeTransformed?.(sh.id, pos, rot, sc)}
        />
      ))}

      {/* Placed lights */}
      {placedLights.map(light => (
        <LightGizmo
          key={light.id}
          light={light}
          isSelected={selectedLightId === light.id}
          isDraggingRef={isDragging}
          onSelect={(id) => { onLightSelect?.(id); onMeshSelect([]); onPropSelect?.(null); }}
          onTransform={(id, pos) => onLightTransformed?.(id, pos)}
        />
      ))}

      {/* Ghost light placement cursor */}
      {placingLightType && ghostPos && (
        <mesh position={ghostPos}>
          <sphereGeometry args={[0.12, 8, 8]} />
          <meshBasicMaterial color="#ffd580" toneMapped={false} transparent opacity={0.6} />
        </mesh>
      )}

      {/* Ghost annotation placement cursor */}
      {placingAnnotation && ghostPos && (
        <mesh position={ghostPos}>
          <sphereGeometry args={[0.10, 8, 8]} />
          <meshBasicMaterial color="#f472b6" toneMapped={false} transparent opacity={0.7} />
        </mesh>
      )}

      {/* Addon GLBs — injected directly into clonedScene so they appear in the scene tree */}
      {clonedScene && addons.map((addon) => (
        <PropErrorBoundary key={addon.id}>
          <Suspense fallback={null}>
            <AddonInjector
              addon={addon}
              clonedScene={clonedScene}
              onSceneChanged={() => setSceneVersion(v => v + 1)}
              onMeshNames={(names) => onAddonMeshNames?.(addon.id, names)}
            />
          </Suspense>
        </PropErrorBoundary>
      ))}

      {/* Annotation pins */}
      {annotations.map((pin) => (
        <AnnotationPinGizmo key={pin.id} pin={pin} />
      ))}

      {/* Invisible ground plane for prop/light/annotation placement raycasting */}
      {(placingPropUrl || placingLightType || placingAnnotation) && (
        <mesh
          rotation={[-Math.PI / 2, 0, 0]}
          position={[0, 0, 0]}
          onPointerMove={handleCanvasPointerMove}
          onPointerDown={handleCanvasPointerDown}
        >
          <planeGeometry args={[500, 500]} />
          <meshBasicMaterial transparent opacity={0} />
        </mesh>
      )}

      {/* Ghost prop preview */}
      {placingPropUrl && ghostPos && (
        <PropErrorBoundary>
          <Suspense fallback={null}>
            <GhostProp
              modelUrl={placingPropUrl}
              position={ghostPos}
              scale={placingPropScale ?? [1, 1, 1]}
            />
          </Suspense>
        </PropErrorBoundary>
      )}

      {s.envLightType === "preset" && (
        <Environment
          preset={envPreset}
          background={s.bgType === "env"}
          environmentIntensity={s.hdriIntensity}
          backgroundIntensity={s.hdriBackgroundBrightness}
          environmentRotation={[0, (s.hdriRotation * Math.PI) / 180, 0]}
          backgroundRotation={[0, (s.hdriRotation * Math.PI) / 180, 0]}
        />
      )}
      {s.envLightType === "hdri" && s.envLightHdriUrl && (
        <Environment
          files={s.envLightHdriUrl}
          background={s.bgType === "env"}
          environmentIntensity={s.hdriIntensity}
          backgroundIntensity={s.hdriBackgroundBrightness}
          environmentRotation={[0, (s.hdriRotation * Math.PI) / 180, 0]}
          backgroundRotation={[0, (s.hdriRotation * Math.PI) / 180, 0]}
        />
      )}
      {s.envLightType === "hdri" && !s.envLightHdriUrl && (
        <Environment
          preset={envPreset}
          background={s.bgType === "env"}
          environmentIntensity={s.hdriIntensity}
          backgroundIntensity={s.hdriBackgroundBrightness}
          environmentRotation={[0, (s.hdriRotation * Math.PI) / 180, 0]}
          backgroundRotation={[0, (s.hdriRotation * Math.PI) / 180, 0]}
        />
      )}

      {/* Sky/ground gradient ambient — much less flat than a plain ambientLight */}
      <hemisphereLight
        args={["#c4d8f0", "#5a4a32", s.ambientIntensity]}
      />
      {/* Key light — sun */}
      <directionalLight
        position={sunPos}
        intensity={s.sunIntensity}
        color={s.sunColor}
        castShadow={s.shadows}
        shadow-mapSize={[2048, 2048]}
        shadow-camera-far={80}
        shadow-camera-left={-30}
        shadow-camera-right={30}
        shadow-camera-top={30}
        shadow-camera-bottom={-30}
        shadow-bias={-0.0005}
        shadow-normalBias={0.03}
        shadow-radius={s.shadowRadius}
      />
      {/* Soft fill light from opposite side */}
      <directionalLight
        position={[-sunPos[0] * 0.5, sunPos[1] * 0.3, -sunPos[2] * 0.5]}
        intensity={s.sunIntensity * 0.15}
        color="#b8cce8"
      />
      {/* Sky dome lights — 4 directional lights at sky angles to approximate overcast diffuse shadows */}
      {s.skyDomeLights && (<>
        <directionalLight position={[ 12,  18,  0]}  intensity={s.skyDomeLightIntensity} color={s.skyDomeLightColor} castShadow={s.shadows && s.skyDomeLightShadows} shadow-mapSize={[1024,1024]} shadow-camera-far={60} shadow-camera-left={-25} shadow-camera-right={25} shadow-camera-top={25} shadow-camera-bottom={-25} shadow-bias={-0.001} shadow-radius={s.shadowRadius * 0.6} />
        <directionalLight position={[-12,  18,  0]}  intensity={s.skyDomeLightIntensity} color={s.skyDomeLightColor} castShadow={s.shadows && s.skyDomeLightShadows} shadow-mapSize={[1024,1024]} shadow-camera-far={60} shadow-camera-left={-25} shadow-camera-right={25} shadow-camera-top={25} shadow-camera-bottom={-25} shadow-bias={-0.001} shadow-radius={s.shadowRadius * 0.6} />
        <directionalLight position={[  0,  18,  12]} intensity={s.skyDomeLightIntensity} color={s.skyDomeLightColor} castShadow={s.shadows && s.skyDomeLightShadows} shadow-mapSize={[1024,1024]} shadow-camera-far={60} shadow-camera-left={-25} shadow-camera-right={25} shadow-camera-top={25} shadow-camera-bottom={-25} shadow-bias={-0.001} shadow-radius={s.shadowRadius * 0.6} />
        <directionalLight position={[  0,  18, -12]} intensity={s.skyDomeLightIntensity} color={s.skyDomeLightColor} castShadow={s.shadows && s.skyDomeLightShadows} shadow-mapSize={[1024,1024]} shadow-camera-far={60} shadow-camera-left={-25} shadow-camera-right={25} shadow-camera-top={25} shadow-camera-bottom={-25} shadow-bias={-0.001} shadow-radius={s.shadowRadius * 0.6} />
      </>)}

      {s.groundPlane && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]} receiveShadow>
          <planeGeometry args={[10000, 10000]} />
          <meshStandardMaterial color={s.groundColor} roughness={0.85} metalness={0} />
        </mesh>
      )}


      {s.showGrid && (
        <Grid
          infiniteGrid
          cellSize={0.5}
          cellThickness={0.4}
          sectionSize={3}
          sectionThickness={1}
          sectionColor="#3a3a3a"
          cellColor="#1e1e1e"
          fadeDistance={60}
          fadeStrength={1.5}
          position={[0, -0.005, 0]}
        />
      )}

      {!skipEffects && (
        <EffectComposer multisampling={0}>
          <N8AO
            aoRadius={s.aoRadius}
            intensity={s.ssao ? s.aoIntensity : 0}
            aoSamples={Math.min(s.aoSamples, 16)}
            denoiseSamples={4}
            quality="medium"
            screenSpaceRadius={false}
            halfRes={false}
            distanceFalloff={1.0}
            color="black"
          />
          <Bloom
            luminanceThreshold={0.85}
            luminanceSmoothing={0.05}
            intensity={s.bloom ? 0.35 : 0}
            blendFunction={BlendFunction.ADD}
          />
          <BrightnessContrast brightness={0} contrast={s.hdriContrast} />
          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
          {((s.aaMode ?? "smaa") !== "none" ? <SMAA /> : null) as any}
        </EffectComposer>
      )}
    </>
  );
}

// ─── LightGizmo ──────────────────────────────────────────────────────────────

function LightGizmo({ light, isSelected, isDraggingRef, onSelect, onTransform }: {
  light: PlacedLight;
  isSelected: boolean;
  isDraggingRef: React.MutableRefObject<boolean>;
  onSelect: (id: string) => void;
  onTransform: (id: string, pos: [number,number,number]) => void;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const GIZMO_R = 0.12;

  return (
    <>
      <group ref={groupRef} position={light.position}>
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
        <mesh
          onPointerDown={(e) => { e.stopPropagation(); onSelect(light.id); }}
        >
          <sphereGeometry args={[GIZMO_R, 10, 10]} />
          <meshBasicMaterial color={light.color} toneMapped={false} />
        </mesh>
        {isSelected && (
          <mesh>
            <sphereGeometry args={[GIZMO_R * 1.5, 10, 10]} />
            <meshBasicMaterial color={light.color} toneMapped={false} transparent opacity={0.15} />
          </mesh>
        )}
      </group>
      {isSelected && groupRef.current && (
        <TransformControls
          object={groupRef.current}
          mode="translate"
          size={0.7}
          onMouseDown={() => { isDraggingRef.current = true; }}
          onMouseUp={() => { isDraggingRef.current = false; }}
          onChange={() => {
            if (!groupRef.current) return;
            const p = groupRef.current.position;
            onTransform(light.id, [p.x, p.y, p.z]);
          }}
        />
      )}
    </>
  );
}

// ─── AddonInjector ────────────────────────────────────────────────────────────
// Null-rendering component: loads the addon GLB, injects it as a named Group
// into clonedScene, then returns null. The group becomes part of the main scene
// tree so its meshes are selectable and appear in the layers panel naturally.

function AddonInjector({
  addon, clonedScene, onSceneChanged, onMeshNames,
}: {
  addon: ProjectAddon;
  clonedScene: THREE.Group;
  onSceneChanged: () => void;
  onMeshNames: (names: string[]) => void;
}) {
  const { scene } = useGLTFDraco(addon.modelUrl);

  // Mount / remount when the addon or the base scene changes
  useEffect(() => {
    const group = new THREE.Group();
    group.name = addon.name;
    group.userData.addonId = addon.id;
    group.position.fromArray(addon.transform.position);
    group.rotation.set(...(addon.transform.rotation as [number, number, number]));
    group.scale.fromArray(addon.transform.scale);
    group.visible = addon.visible;

    const addonClone = scene.clone(true);
    addonClone.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        obj.castShadow = true;
        obj.receiveShadow = true;
      }
    });
    group.add(addonClone);
    clonedScene.add(group);

    const names: string[] = [];
    addonClone.traverse((obj) => { if (obj instanceof THREE.Mesh && obj.name) names.push(obj.name); });
    onMeshNames(names);
    onSceneChanged();

    return () => {
      clonedScene.remove(group);
      onSceneChanged();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scene, clonedScene, addon.id]);

  // Sync transform live (when user moves the group via TransformControls,
  // handleTransformChange → onAddonTransformed → addon.transform updates → this runs)
  useEffect(() => {
    let found: THREE.Object3D | null = null;
    clonedScene.traverse((obj) => { if (!found && obj.userData?.addonId === addon.id) found = obj; });
    const g = found as THREE.Object3D | null;
    if (!g) return;
    g.position.fromArray(addon.transform.position);
    g.rotation.set(...(addon.transform.rotation as [number, number, number]));
    g.scale.fromArray(addon.transform.scale);
  }, [addon.transform, clonedScene, addon.id]);

  // Sync visibility
  useEffect(() => {
    let found: THREE.Object3D | null = null;
    clonedScene.traverse((obj) => { if (!found && obj.userData?.addonId === addon.id) found = obj; });
    const g = found as THREE.Object3D | null;
    if (g) g.visible = addon.visible;
  }, [addon.visible, clonedScene, addon.id]);

  return null;
}

// ─── AnnotationPinGizmo ────────────────────────────────────────────────────────

function AnnotationPinGizmo({ pin }: { pin: AnnotationPin }) {
  const [hovered, setHovered] = useState(false);
  return (
    <group position={pin.position}>
      <mesh
        onPointerOver={() => setHovered(true)}
        onPointerOut={() => setHovered(false)}
      >
        <sphereGeometry args={[0.08, 10, 10]} />
        <meshBasicMaterial color={pin.color} toneMapped={false} />
      </mesh>
      {hovered && (
        <Html
          center
          distanceFactor={10}
          style={{ pointerEvents: "none" }}
          position={[0, 0.25, 0]}
        >
          <div style={{
            background: "rgba(0,0,0,0.85)",
            color: "#f9fafb",
            fontSize: 11,
            padding: "4px 8px",
            borderRadius: 6,
            whiteSpace: "nowrap",
            maxWidth: 200,
            backdropFilter: "blur(4px)",
            border: `1px solid ${pin.color}40`,
          }}>
            {pin.text}
          </div>
        </Html>
      )}
    </group>
  );
}

function PlacedProp({ modelUrl, position, rotation, scale, isSelected, transformMode = "translate", onSelect, onTransformed }: {
  modelUrl: string;
  position: [number,number,number];
  rotation: [number,number,number];
  scale: [number,number,number];
  isSelected?: boolean;
  transformMode?: "translate" | "rotate" | "scale";
  onSelect?: () => void;
  onTransformed?: (pos: [number,number,number], rot: [number,number,number], sc: [number,number,number]) => void;
}) {
  const { scene } = useGLTF(modelUrl, "/draco/");
  const clone = React.useMemo(() => scene.clone(true), [scene]);
  const primitiveRef = useRef<THREE.Group>(null);

  function handleTransformChange() {
    const o = primitiveRef.current;
    if (!o) return;
    onTransformed?.(
      [o.position.x, o.position.y, o.position.z],
      [o.rotation.x, o.rotation.y, o.rotation.z],
      [o.scale.x,    o.scale.y,    o.scale.z],
    );
  }

  return (
    <>
      <primitive
        ref={primitiveRef}
        object={clone}
        position={position}
        rotation={rotation}
        scale={scale}
        onPointerDown={(e: ThreeEvent<PointerEvent>) => { e.stopPropagation(); onSelect?.(); }}
      />
      {isSelected && primitiveRef.current && (
        <TransformControls
          object={primitiveRef.current}
          mode={transformMode}
          onChange={handleTransformChange}
          size={0.7}
        />
      )}
    </>
  );
}

function GhostProp({ modelUrl, position, scale }: {
  modelUrl: string; position: [number,number,number]; scale: [number,number,number];
}) {
  const { scene } = useGLTF(modelUrl, "/draco/");
  const clone = useRef<THREE.Group | null>(null);
  if (!clone.current) {
    clone.current = scene.clone(true);
    clone.current.traverse(o => {
      if (o instanceof THREE.Mesh) {
        o.material = new THREE.MeshStandardMaterial({ color: "#60a5fa", transparent: true, opacity: 0.45, depthWrite: false });
      }
    });
  }
  return <primitive object={clone.current} position={position} scale={scale} />;
}

// ─── Placed shapes ────────────────────────────────────────────────────────────

function makeShapeGeometry(type: ShapeType): THREE.BufferGeometry {
  switch (type) {
    case "box":      return new THREE.BoxGeometry(1, 1, 1);
    case "sphere":   return new THREE.SphereGeometry(0.5, 32, 16);
    case "plane":    return new THREE.PlaneGeometry(1, 1);
    case "cylinder": return new THREE.CylinderGeometry(0.5, 0.5, 1, 32);
    case "cone":     return new THREE.ConeGeometry(0.5, 1, 32);
    case "torus":    return new THREE.TorusGeometry(0.4, 0.15, 16, 48);
  }
}

function PlacedShape({ shape, isSelected, transformMode = "translate", onSelect, onTransformed, clonedScene, materials }: {
  shape: PlacedShapeData;
  isSelected?: boolean;
  transformMode?: "translate" | "rotate" | "scale";
  onSelect?: () => void;
  onTransformed?: (pos: [number,number,number], rot: [number,number,number], sc: [number,number,number]) => void;
  clonedScene?: THREE.Group | null;
  materials?: MaterialLibraryEntry[];
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const geo = React.useMemo(() => makeShapeGeometry(shape.shapeType), [shape.shapeType]);

  const libEntry = shape.material_id ? (materials?.find(m => m.id === shape.material_id) ?? null) : null;

  const mat = React.useMemo(() => {
    if (libEntry) {
      const p = libEntry.properties ?? {};
      const brightness = p.albedoBrightness ?? 1;
      const baseColor = new THREE.Color(libEntry.base_color);
      if (brightness !== 1) baseColor.multiplyScalar(brightness);
      return new THREE.MeshPhysicalMaterial({
        color: baseColor,
        roughness: libEntry.roughness,
        metalness: libEntry.metalness,
        opacity: p.opacity ?? 1,
        transparent: (p.opacity ?? 1) < 1 || (p.transmission ?? 0) > 0,
        ior: p.ior ?? 1.5,
        clearcoat: p.clearcoat ?? 0,
        clearcoatRoughness: p.clearcoatRoughness ?? 0,
        transmission: p.transmission ?? 0,
        wireframe: shape.wireframe ?? false,
      });
    }
    return new THREE.MeshPhysicalMaterial({
      color: shape.color,
      roughness: shape.roughness,
      metalness: shape.metalness,
      opacity: shape.opacity,
      transparent: shape.opacity < 1,
      wireframe: shape.wireframe ?? false,
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [libEntry?.id, shape.color, shape.roughness, shape.metalness, shape.opacity, shape.wireframe]);

  // Deferred texture loading for library materials
  useEffect(() => {
    if (!libEntry || !meshRef.current) return;
    const m = meshRef.current.material as THREE.MeshPhysicalMaterial;
    const p = libEntry.properties ?? {};
    const loader = new THREE.TextureLoader();
    const brightness = p.albedoBrightness ?? 1;

    function loadTex(url: string | null | undefined, slot: string, srgb = false) {
      if (!url) return;
      loader.load(url, (tex) => {
        tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
        tex.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.LinearSRGBColorSpace;
        if ((p.uvProjection ?? "uv") === "uv") {
          tex.repeat.set(p.uvRepeatX ?? 1, p.uvRepeatY ?? 1);
          tex.offset.set(p.uvOffsetX ?? 0, p.uvOffsetY ?? 0);
          tex.rotation = ((p.uvRotation ?? 0) * Math.PI) / 180;
        }
        tex.needsUpdate = true;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (m as any)[slot] = tex;
        if (slot === "map" && !p.colorTint) {
          m.color.set("#ffffff");
          if (brightness !== 1) m.color.multiplyScalar(brightness);
        }
        if (slot === "normalMap") m.normalScale.set(p.normalScale ?? 1, p.normalScale ?? 1);
        if (slot === "bumpMap") m.bumpScale = p.bumpScale ?? 0.05;
        if (slot === "aoMap") m.aoMapIntensity = p.aoIntensity ?? 1;
        m.needsUpdate = true;
      });
    }

    loadTex(p.albedoMapUrl, "map", true);
    loadTex(p.normalMapUrl, "normalMap");
    loadTex(p.roughnessMapUrl, "roughnessMap");
    loadTex(p.metalnessMapUrl, "metalnessMap");
    loadTex(p.bumpMapUrl, "bumpMap");
    loadTex(p.aoMapUrl, "aoMap");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [libEntry?.id]);

  // Update inline material (only when no library material)
  useEffect(() => {
    if (!meshRef.current || libEntry) return;
    const m = meshRef.current.material as THREE.MeshPhysicalMaterial;
    m.color.set(shape.color);
    m.roughness = shape.roughness;
    m.metalness = shape.metalness;
    m.opacity = shape.opacity;
    m.transparent = shape.opacity < 1;
    m.wireframe = shape.wireframe ?? false;
    m.needsUpdate = true;
  }, [libEntry, shape.color, shape.roughness, shape.metalness, shape.opacity, shape.wireframe]);

  function handleTransformChange() {
    const o = meshRef.current;
    if (!o) return;
    onTransformed?.(
      [o.position.x, o.position.y, o.position.z],
      [o.rotation.x, o.rotation.y, o.rotation.z],
      [o.scale.x, o.scale.y, o.scale.z],
    );
  }

  // If parentMesh is set, find its world transform and wrap in a group
  const parentWorldMatrix = React.useMemo(() => {
    if (!shape.parentMesh || !clonedScene) return null;
    let parentObj: THREE.Object3D | null = null;
    clonedScene.traverse((o) => { if (o.name === shape.parentMesh) parentObj = o; });
    if (!parentObj) return null;
    const m = new THREE.Matrix4();
    (parentObj as THREE.Object3D).updateWorldMatrix(true, false);
    m.copy((parentObj as THREE.Object3D).matrixWorld);
    return m;
  }, [shape.parentMesh, clonedScene]);

  const mesh = (
    <mesh
      ref={meshRef}
      name={shape.name}
      geometry={geo}
      material={mat}
      position={shape.position}
      rotation={shape.rotation}
      scale={shape.scale}
      castShadow
      receiveShadow
      onPointerDown={(e: ThreeEvent<PointerEvent>) => { e.stopPropagation(); onSelect?.(); }}
    />
  );

  return (
    <>
      {parentWorldMatrix ? (
        <group matrix={parentWorldMatrix} matrixAutoUpdate={false}>
          {mesh}
        </group>
      ) : mesh}
      {isSelected && meshRef.current && (
        <TransformControls
          object={meshRef.current}
          mode={transformMode}
          onChange={handleTransformChange}
          size={0.75}
        />
      )}
    </>
  );
}

// ─── Public component ─────────────────────────────────────────────────────────

interface SceneEditorViewportProps {
  modelUrl: string;
  selectedMeshNames: string[];
  onMeshSelect: (names: string[]) => void;
  onSceneLoaded: (tree: SceneTreeNode[]) => void;
  transformMode: TransformMode | "none";
  sceneSettings: SceneSettings;
  meshOverrides: MeshOverrides;
  onMeshTransformStart?: () => void;
  onMeshTransformed: (name: string, pos: [number,number,number], rot: [number,number,number], sc: [number,number,number]) => void;
  placedProps?: EditorSceneProps["placedProps"];
  placedShapes?: PlacedShapeData[];
  selectedShapeId?: string | null;
  onShapeSelect?: (id: string | null) => void;
  onShapeTransformed?: (id: string, pos: [number,number,number], rot: [number,number,number], sc: [number,number,number]) => void;
  shapeTransformMode?: "translate" | "rotate" | "scale";
  shapeMaterials?: MaterialLibraryEntry[];
  isolationMeshes?: string[];
  paintHighlightMeshes?: string[];
  meshMaterials?: Record<string, MeshMaterialDef>;
  onGlbMats?: (mats: GlbMaterialInfo[]) => void;
  hiddenLayers?: Set<string>;
  deletedMeshes?: Set<string>;
  placingPropUrl?: string | null;
  placingPropScale?: [number, number, number];
  onPropPlaced?: (pos: [number,number,number]) => void;
  onCancelPlacement?: () => void;
  selectedPropId?: string | null;
  onPropSelect?: (id: string | null) => void;
  onPropTransformed?: (id: string, pos: [number,number,number], rot: [number,number,number], sc: [number,number,number]) => void;
  propTransformMode?: "translate" | "rotate" | "scale";
  placedLights?: PlacedLight[];
  placingLightType?: "point" | "spot" | null;
  onLightPlaced?: (pos: [number,number,number]) => void;
  selectedLightId?: string | null;
  onLightSelect?: (id: string | null) => void;
  onLightTransformed?: (id: string, pos: [number,number,number]) => void;
  onMeshDoubleClick?: (name: string) => void;
  // Increment to trigger path tracer BVH rebuild after geometry changes
  sceneVersion?: number;
  // Addon GLBs
  addons?: ProjectAddon[];
  onAddonTransformed?: (id: string, pos: [number,number,number], rot: [number,number,number], sc: [number,number,number]) => void;
  onAddonMeshNames?: (addonId: string, names: string[]) => void;
  onSceneTreeUpdate?: (tree: SceneTreeNode[]) => void;
  onTriangleCounts?: (counts: MeshTriangleCounts) => void;
  // Annotations
  annotations?: AnnotationPin[];
  placingAnnotation?: boolean;
  onAnnotationPlaced?: (pos: [number,number,number]) => void;
}

function SceneLoadingOverlay() {
  const { progress } = useProgress();
  const pct = Math.round(progress);
  return (
    <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-[#0d0d0d] gap-4 pointer-events-none">
      <div className="flex flex-col items-center gap-3 w-48">
        <div className="flex items-center justify-between w-full">
          <span className="text-[10px] uppercase tracking-[0.2em] text-white/25">Loading scene</span>
          <span className="text-[10px] font-mono text-white/30 tabular-nums">{pct}%</span>
        </div>
        <div className="w-full h-[2px] bg-white/8 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-300"
            style={{
              width: `${Math.max(pct, 3)}%`,
              background: "linear-gradient(90deg, rgba(99,102,241,0.6), rgba(139,92,246,0.9))",
              boxShadow: "0 0 6px rgba(139,92,246,0.4)",
            }}
          />
        </div>
      </div>
    </div>
  );
}

const SceneEditorViewport = forwardRef<SceneEditorViewportHandle, SceneEditorViewportProps>(
  ({ placedProps = [], placedShapes, selectedShapeId, onShapeSelect, onShapeTransformed, shapeTransformMode, shapeMaterials,
     isolationMeshes, paintHighlightMeshes, meshMaterials, onGlbMats, deletedMeshes,
     placingPropUrl, placingPropScale, onPropPlaced, onCancelPlacement,
     selectedPropId, onPropSelect, onPropTransformed, propTransformMode,
     placedLights = [], placingLightType, onLightPlaced,
     selectedLightId, onLightSelect, onLightTransformed,
     onMeshDoubleClick, sceneVersion = 0,
     addons = [], onAddonTransformed, onAddonMeshNames, onSceneTreeUpdate, onTriangleCounts,
     annotations = [], placingAnnotation = false, onAnnotationPlaced,
     ...props }, ref) => {
    const cameraCaptureRef = useRef<(() => CameraCoords | null) | null>(null);
    const screenshotRef    = useRef<(() => string) | null>(null);
    const flyToRef         = useRef<((coords: CameraCoords) => void) | null>(null);
    const glbMatsRef       = useRef<GlbMaterialInfo[]>([]);
    const [loaded, setLoaded] = useState(false);
    const [ptStatus, setPtStatus] = useState<PTStatus>({ state: "off", samples: 0 });
    const ptActive = ptStatus.state === "rendering" || ptStatus.state === "done";

    useEffect(() => { setLoaded(false); }, [props.modelUrl]);

    useImperativeHandle(ref, () => ({
      getCameraCoords:  () => cameraCaptureRef.current?.() ?? null,
      takeScreenshot:   () => screenshotRef.current?.() ?? "",
      getGlbMaterials:  () => glbMatsRef.current,
      flyTo:            (coords) => flyToRef.current?.(coords),
    }));

    return (
      <div
        className="relative w-full h-full"
        onContextMenu={(e) => { e.preventDefault(); if (placingPropUrl) onCancelPlacement?.(); }}
      >
        {!loaded && <SceneLoadingOverlay />}
        {/* Path tracing status badge */}
        {props.sceneSettings.pathTracing && ptStatus.state !== "off" && (
          <div className="absolute bottom-3 right-3 z-20 flex items-center gap-1.5 px-2 py-1 rounded-lg bg-black/60 backdrop-blur-sm border border-white/10 pointer-events-none select-none">
            {ptStatus.state === "building" && <><span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" /><span className="text-[9px] text-white/50 tracking-wider">Building BVH… {ptStatus.samples > 0 ? `${ptStatus.samples}%` : ""}</span></>}
            {ptStatus.state === "waiting"  && <><span className="w-1.5 h-1.5 rounded-full bg-white/30" /><span className="text-[9px] text-white/30 tracking-wider">PT ready</span></>}
            {ptStatus.state === "rendering" && <><span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /><span className="text-[9px] text-emerald-300/80 tabular-nums tracking-wider">PT {ptStatus.samples}</span></>}
            {ptStatus.state === "done"     && <><span className="w-1.5 h-1.5 rounded-full bg-emerald-400" /><span className="text-[9px] text-emerald-300/80 tracking-wider">PT ✓</span></>}
            {ptStatus.state === "error"    && <><span className="w-1.5 h-1.5 rounded-full bg-red-400" /><span className="text-[9px] text-red-400/80 tracking-wider">PT failed</span></>}
          </div>
        )}

        <Canvas
          shadows={props.sceneSettings.shadows ? "soft" : false}
          dpr={[1, 2]}
          camera={{ position: [8, 6, 12], fov: props.sceneSettings.cameraFov ?? 45 }}
          gl={{
            antialias: true,
            alpha: false,
            toneMapping: ACESFilmicToneMapping,
            toneMappingExposure: 1.1,
            outputColorSpace: SRGBColorSpace,
          }}
          onCreated={({ gl }) => {
            gl.setClearColor("#0d0d0d", 1);
          }}
          onPointerMissed={() => { if (!placingPropUrl && !placingLightType) { props.onMeshSelect([]); onPropSelect?.(null); onShapeSelect?.(null); onLightSelect?.(null); } }}
        >
          <Suspense fallback={null}>
            <EditorScene
              {...props}
              placedProps={placedProps}
              isolationMeshes={isolationMeshes}
              paintHighlightMeshes={paintHighlightMeshes}
              meshMaterials={meshMaterials}
              cameraCaptureRef={cameraCaptureRef}
              screenshotRef={screenshotRef}
              flyToRef={flyToRef}
              onSceneLoaded={(tree) => { setLoaded(true); props.onSceneLoaded?.(tree); }}
              onGlbMats={(mats) => {
                glbMatsRef.current = mats;
                onGlbMats?.(mats);
              }}
              deletedMeshes={deletedMeshes}
              placingPropUrl={placingPropUrl}
              placingPropScale={placingPropScale}
              onPropPlaced={onPropPlaced}
              selectedPropId={selectedPropId}
              onPropSelect={onPropSelect}
              onPropTransformed={onPropTransformed}
              propTransformMode={propTransformMode}
              placedLights={placedLights}
              placingLightType={placingLightType}
              onLightPlaced={onLightPlaced}
              selectedLightId={selectedLightId}
              onLightSelect={onLightSelect}
              onLightTransformed={onLightTransformed}
              onMeshDoubleClick={onMeshDoubleClick}
              skipEffects={ptActive}
              placedShapes={placedShapes}
              selectedShapeId={selectedShapeId}
              onShapeSelect={onShapeSelect}
              onShapeTransformed={onShapeTransformed}
              shapeTransformMode={shapeTransformMode}
              shapeMaterials={shapeMaterials}
              addons={addons}
              onAddonTransformed={onAddonTransformed}
              onAddonMeshNames={onAddonMeshNames}
              onSceneTreeUpdate={onSceneTreeUpdate}
              onTriangleCounts={onTriangleCounts}
              annotations={annotations}
              placingAnnotation={placingAnnotation}
              onAnnotationPlaced={onAnnotationPlaced}
            />
          </Suspense>

          <PathTracerController
            enabled={props.sceneSettings.pathTracing ?? false}
            bounces={props.sceneSettings.pathTracingBounces ?? 4}
            sceneVersion={sceneVersion}
            onStatus={setPtStatus}
          />

          <GizmoHelper alignment="bottom-right" margin={[72, 72]}>
            <GizmoViewport
              axisColors={["#f43f5e", "#4ade80", "#60a5fa"]}
              labelColor="white"
            />
          </GizmoHelper>
        </Canvas>
      </div>
    );
  }
);

SceneEditorViewport.displayName = "SceneEditorViewport";
export default SceneEditorViewport;
