"use client";

/**
 * Loads a GLB model and applies visibility + material variants.
 * Wrapped in Suspense by R3FViewer — suspends until the GLB is ready.
 *
 * Design notes:
 *  - useState for the clone so React re-renders when the model changes
 *  - useLayoutEffect for all Three.js mutations: fires after React commits but
 *    BEFORE requestAnimationFrame, so R3F always renders the updated scene
 *    in the same frame — no 1-frame flicker and no manual invalidate needed
 *    for the visibility/material passes (we still call invalidate to wake
 *    R3F's demand-mode renderer after the layout pass)
 */

import { useState, useEffect, useLayoutEffect, useRef } from "react";
import { useThree, useLoader } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import { GLTFLoader, DRACOLoader } from "three-stdlib";
import type { GLTF } from "three-stdlib";
import * as THREE from "three";

const _dracoLoader = new DRACOLoader();
_dracoLoader.setDecoderPath("https://www.gstatic.com/draco/versioned/decoders/1.5.5/");
_dracoLoader.preload();
function useGLTFDraco(url: string): GLTF {
  return useLoader(GLTFLoader, url, (loader) => {
    (loader as GLTFLoader).setDRACOLoader(_dracoLoader);
  }) as unknown as GLTF;
}
import { PhaseId } from "@/constants/phases";
import { ModelNodeGroups, Option, OptionType } from "@/types/database";
import {
  applyR3FVisibility,
  applyMaterialOverride,
  applyProjection,
  applyGltfVariant,
  captureOriginalMaterials,
  restoreOriginalMaterials,
  LevelId,
  type StructuralNodeArrays,
} from "@/lib/three/variant-engine";
import type { MaterialLibraryEntry } from "@/types/database";
import { capTextureSize } from "@/lib/three/cap-texture-size";

function invertGlossinessTexture(src: THREE.Texture): THREE.CanvasTexture {
  const img = src.image as HTMLImageElement | HTMLCanvasElement | ImageBitmap;
  const w = (img as HTMLImageElement).naturalWidth  || (img as HTMLCanvasElement).width  || 256;
  const h = (img as HTMLImageElement).naturalHeight || (img as HTMLCanvasElement).height || 256;
  const canvas = document.createElement("canvas");
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(img as CanvasImageSource, 0, 0, w, h);
  const id = ctx.getImageData(0, 0, w, h);
  for (let i = 0; i < id.data.length; i += 4) {
    id.data[i]     = 255 - id.data[i];
    id.data[i + 1] = 255 - id.data[i + 1];
    id.data[i + 2] = 255 - id.data[i + 2];
  }
  ctx.putImageData(id, 0, 0);
  const t = new THREE.CanvasTexture(canvas);
  t.wrapS = t.wrapT = src.wrapS;
  t.repeat.copy(src.repeat);
  t.offset.copy(src.offset);
  t.rotation = src.rotation;
  t.colorSpace = THREE.LinearSRGBColorSpace;
  return t;
}

type GlbOverrideMap = Record<string, {
  base_color: string;
  roughness: number;
  metalness: number;
  properties?: MaterialLibraryEntry["properties"];
}>;

interface HomeModelProps {
  modelUrl: string;
  currentPhase: PhaseId;
  currentLevel: LevelId;
  selectedOptions?: string[];
  allOptionNodes?: string[];
  nodeGroups?: ModelNodeGroups;
  selectedOptionObjects?: Record<string, Option>;
  materialLibrary?: MaterialLibraryEntry[];
  meshBaseMatMap?: Record<string, string>;
  glbMatOverrides?: GlbOverrideMap;
  structuralArrays?: StructuralNodeArrays;
  onSceneReady?: (scene: THREE.Group) => void;
}

function applyGlbOverridesToScene(scene: THREE.Group, overrides: GlbOverrideMap) {
  if (!Object.keys(overrides).length) return;
  const loader = new THREE.TextureLoader();

  scene.traverse((obj) => {
    if (!(obj instanceof THREE.Mesh)) return;
    const mats = Array.isArray(obj.material) ? obj.material : [obj.material];

    const newMats = mats.map((mat) => {
      if (!mat?.name) return mat;
      const ov = overrides[mat.name];
      if (!ov) return mat;

      const orig = mat instanceof THREE.MeshStandardMaterial ? mat : null;
      const p = ov.properties ?? {};
      const projection = p.uvProjection ?? "uv";
      const worldScale = 1 / Math.max(p.uvScale ?? 1, 0.001);
      const brightness = p.albedoBrightness ?? 1;

      // Show base_color as placeholder while URL textures download (no black flash).
      // GLB-embedded textures (orig.map etc.) are already loaded — assign immediately.
      const origColorHex = orig?.color ? `#${orig.color.getHexString()}` : "#ffffff";
      const placeholderColor = new THREE.Color(p.albedoMapUrl ? ov.base_color : origColorHex);
      if (brightness !== 1) placeholderColor.multiplyScalar(brightness);

      const newMat = new THREE.MeshPhysicalMaterial({
        color:        placeholderColor,
        roughness:    ov.roughness,
        metalness:    ov.metalness,
        opacity:      p.opacity ?? orig?.opacity ?? 1,
        transparent:  (p.opacity ?? 1) < 1 || (p.transmission ?? 0) > 0 || (orig?.transparent ?? false),
        ior:          p.ior ?? 1.5,
        transmission: p.transmission ?? 0,
        clearcoat:    p.clearcoat ?? 0,
        clearcoatRoughness: p.clearcoatRoughness ?? 0,
      });

      // Defer URL-based textures so we never show a blank (black) texture.
      // GLB-inherited textures are already in GPU memory — use them immediately.
      function loadDeferred(
        url: string | null | undefined,
        fallback: THREE.Texture | null | undefined,
        slot: "map" | "normalMap" | "bumpMap" | "roughnessMap" | "metalnessMap" | "aoMap" | "displacementMap",
        srgb = false,
        invert = false,
      ) {
        if (url) {
          loader.load(url, (loaded) => {
            capTextureSize(loaded);
            loaded.wrapS = loaded.wrapT = THREE.RepeatWrapping;
            loaded.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.LinearSRGBColorSpace;
            if (projection === "uv") {
              loaded.repeat.set(p.uvRepeatX ?? 1, p.uvRepeatY ?? 1);
              loaded.offset.set(p.uvOffsetX ?? 0, p.uvOffsetY ?? 0);
              loaded.rotation = ((p.uvRotation ?? 0) * Math.PI) / 180;
            }
            loaded.needsUpdate = true;
            let tex: THREE.Texture = loaded;
            if (invert) tex = invertGlossinessTexture(loaded);
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (newMat as any)[slot] = tex;
            if (slot === "map" && !p.colorTint) {
              newMat.color.set(origColorHex);
              if (brightness !== 1) newMat.color.multiplyScalar(brightness);
            }
            if (slot === "normalMap")       newMat.normalScale.set(p.normalScale ?? 1, p.normalScale ?? 1);
            if (slot === "bumpMap")         newMat.bumpScale = p.bumpScale ?? 0.05;
            if (slot === "aoMap")           newMat.aoMapIntensity = p.aoIntensity ?? 1;
            if (slot === "displacementMap") newMat.displacementScale = p.displacementScale ?? 0.05;
            newMat.needsUpdate = true;
          });
        } else if (fallback) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (newMat as any)[slot] = fallback;
        }
      }

      const useGloss = !p.roughnessMapUrl && !!p.glossinessMapUrl;
      loadDeferred(p.albedoMapUrl,                            orig?.map,          "map",          true);
      loadDeferred(p.normalMapUrl,                            orig?.normalMap,    "normalMap");
      loadDeferred(p.roughnessMapUrl ?? p.glossinessMapUrl,  orig?.roughnessMap, "roughnessMap", false, useGloss);
      loadDeferred(p.metalnessMapUrl,                         orig?.metalnessMap, "metalnessMap");
      loadDeferred(p.aoMapUrl,                                orig?.aoMap,        "aoMap");
      loadDeferred(p.bumpMapUrl,                              orig?.bumpMap,      "bumpMap");
      loadDeferred(p.displacementMapUrl,                      null,               "displacementMap");

      // Apply scalar extras for already-set inherited textures
      if (!p.normalMapUrl    && orig?.normalMap)    newMat.normalScale.set(p.normalScale ?? 1, p.normalScale ?? 1);
      if (!p.bumpMapUrl      && orig?.bumpMap)      newMat.bumpScale = p.bumpScale ?? 0.05;
      if (!p.aoMapUrl        && orig?.aoMap)        newMat.aoMapIntensity = p.aoIntensity ?? 1;

      newMat.envMapIntensity = 1.0;
      if (p.emissiveColor && (p.emissiveIntensity ?? 0) > 0) {
        newMat.emissive.set(p.emissiveColor);
        newMat.emissiveIntensity = p.emissiveIntensity ?? 0;
      }

      // Set up projection shader immediately — albedo slot fills async.
      if (projection !== "uv" && p.albedoMapUrl) {
        applyProjection(newMat, projection, worldScale, p.uvScaleX, p.uvScaleY, p.uvScaleZ, p.uvTriOffsetX, p.uvTriOffsetY, p.uvTriOffsetZ, p.uvTriRotation);
      }

      return newMat;
    });

    obj.material = Array.isArray(obj.material) ? newMats : newMats[0];
  });
}

export default function HomeModel({
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
  onSceneReady,
}: HomeModelProps) {
  const { scene }    = useGLTFDraco(modelUrl);
  const { invalidate } = useThree();
  const [model, setModel] = useState<THREE.Group | null>(null);
  const reportedRef  = useRef(false);
  // Stable ref so the clone effect doesn't need glbMatOverrides in its deps
  const overridesRef = useRef(glbMatOverrides);
  overridesRef.current = glbMatOverrides;
  // Tracks which mesh names are currently overridden by option materials so we
  // can restore them when the selection changes to an option with no material.
  const optionOverriddenMeshes = useRef(new Set<string>());

  // ── Clone once per model URL ───────────────────────────────────────────────
  useEffect(() => {
    const clone = scene.clone(true);
    applyGlbOverridesToScene(clone, overridesRef.current);
    // Capture AFTER overrides so restoreOriginalMaterials brings back the overridden state.
    clone.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        obj.castShadow = true;
        obj.receiveShadow = true;
        if (obj.name) captureOriginalMaterials(clone, [obj.name]);
      }
    });
    setModel(clone);                     // triggers re-render → primitive mounts
    if (!reportedRef.current) {
      reportedRef.current = true;
      onSceneReady?.(clone);             // hide loading overlay in R3FViewer
    }
    // Reset on cleanup so React Strict Mode's second invocation can re-report ready.
    return () => { reportedRef.current = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modelUrl]);

  // Options are "seeded" once at least one category has a chosen option.
  // Before seeding we leave all option-node visibility untouched (everything
  // visible from the GLB default) — avoids a 1-frame "all hidden" flash.
  const optionsSeeded = Object.keys(selectedOptionObjects ?? {}).length > 0;

  // ── Visibility ─────────────────────────────────────────────────────────────
  // useLayoutEffect fires synchronously after React commits, BEFORE RAF, so
  // Three.js mutations are always captured in the same rendered frame.
  useLayoutEffect(() => {
    if (!model) return;
    const effectiveSelected = optionsSeeded ? selectedOptions : null;
    applyR3FVisibility(
      model,
      currentPhase,
      currentLevel,
      nodeGroups,
      effectiveSelected,
      allOptionNodes,
      structuralArrays,
    );

    // ── Visibility diagnostic ────────────────────────────────────────────────
    if (effectiveSelected) {
      const selectedSet = new Set(effectiveSelected);

      const sceneNames = new Set<string>();
      model.traverse((o) => { if (o.name) sceneNames.add(o.name); });

      const shouldBeHidden = allOptionNodes.filter(n => !selectedSet.has(n));
      const notHidden: string[] = [];
      for (const name of shouldBeHidden) {
        model.traverse((o) => { if (o.name === name && o.visible) notHidden.push(name); });
      }
      const hidden: string[] = [];
      model.traverse((o) => { if (!o.visible && o.name) hidden.push(o.name); });
      const missingFromScene = allOptionNodes.filter(n => !sceneNames.has(n));

      // Flat lines so values are readable without expanding
      console.warn(`[VIS] phase=${currentPhase} | selected=${effectiveSelected.length} | allNodes=${allOptionNodes.length} | shouldHide=${shouldBeHidden.length} | actuallyHidden=${hidden.length} | STUCK_VISIBLE=${notHidden.length} | missing=${missingFromScene.length}`);
      if (notHidden.length > 0)
        console.warn("[VIS] STUCK_VISIBLE nodes:", notHidden.slice(0, 10));
      if (missingFromScene.length > 0)
        console.warn("[VIS] missing from scene:", missingFromScene.slice(0, 10));
      if (shouldBeHidden.length > 0 && notHidden.length === 0 && hidden.length === 0)
        console.warn("[VIS] shouldBeHidden names:", shouldBeHidden.slice(0, 10), "← these should be invisible but hidden=0; names may not resolve in scene");
      console.warn("[VIS] sample GLB names:", [...sceneNames].slice(0, 8));
      console.warn("[VIS] sample DB nodes:", allOptionNodes.slice(0, 8));
    }
    invalidate();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [model, currentPhase, currentLevel, nodeGroups, selectedOptions, allOptionNodes, structuralArrays, optionsSeeded]);


  // ── Base material assignments ──────────────────────────────────────────────
  useLayoutEffect(() => {
    if (!model) return;
    for (const [meshName, matId] of Object.entries(meshBaseMatMap)) {
      const entry = materialLibrary.find((m) => m.id === matId);
      if (entry) applyMaterialOverride(model, [meshName], entry);
    }
    invalidate();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [model, meshBaseMatMap, materialLibrary]);

  // ── Option material variants + overrides ───────────────────────────────────
  useLayoutEffect(() => {
    if (!model || !selectedOptionObjects) return;

    // Step 1: restore ALL meshes that were overridden in the previous render.
    // This handles the case where the new selected option has no material override
    // (e.g. switching from "Black Shingles" back to "Brown Shingles" which uses
    // the default GLB material) — without this, the old material would stick.
    if (optionOverriddenMeshes.current.size > 0) {
      restoreOriginalMaterials(model, [...optionOverriddenMeshes.current]);
      optionOverriddenMeshes.current = new Set();
    }

    // Step 2: collect which meshes the current selection will override.
    // We track ALL potential meshes (ignoring conditions) so that when a condition
    // becomes false, the mesh is still restored to its original material.
    const nextOverridden = new Set<string>();
    for (const option of Object.values(selectedOptionObjects)) {
      const type: OptionType = option.option_type ?? "visibility";
      if (type === "material_variant" || type === "material_override") {
        if (option.material_assignments?.length) {
          option.material_assignments.forEach((a) => nextOverridden.add(a.mesh_name));
        } else if (option.node_list?.length) {
          option.node_list.forEach((n) => nextOverridden.add(n));
        }
      }
    }

    // Build the set of active option IDs for condition evaluation.
    const activeOptionIds = new Set(Object.values(selectedOptionObjects).map(o => o.id));

    // Step 3: apply the current selection's material overrides.
    for (const option of Object.values(selectedOptionObjects)) {
      const type: OptionType = option.option_type ?? "visibility";
      if (type === "material_variant" && option.variant_name && option.node_list?.length) {
        applyGltfVariant(model, option.variant_name, option.node_list);
      }
      if (type === "material_override") {
        if (option.material_assignments?.length) {
          for (const a of option.material_assignments) {
            const conditionId = option.node_conditions?.[a.mesh_name];
            if (conditionId && !activeOptionIds.has(conditionId)) continue;
            const entry = materialLibrary.find((m) => m.id === a.material_id);
            if (entry) applyMaterialOverride(model, [a.mesh_name], entry);
          }
        } else if (option.material_id && option.node_list?.length) {
          const activeMeshes = option.node_list.filter(n => {
            const conditionId = option.node_conditions?.[n];
            return !conditionId || activeOptionIds.has(conditionId);
          });
          if (activeMeshes.length) {
            const entry = materialLibrary.find((m) => m.id === option.material_id);
            if (entry) applyMaterialOverride(model, activeMeshes, entry);
          }
        }
      }
    }

    optionOverriddenMeshes.current = nextOverridden;
    invalidate();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [model, selectedOptionObjects, materialLibrary]);

  if (!model) return null;
  return <primitive object={model} dispose={null} />;
}

HomeModel.preload = (url: string) => useGLTF.preload(url, "/draco/");
