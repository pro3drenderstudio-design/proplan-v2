/**
 * R3F visibility + material variant engine.
 * Direct Three.js parallel of src/logic/visibilityController.ts.
 *
 * PASS ORDER (same as Sketchfab engine):
 *   Pass 1 — Option-driven mesh visibility
 *   Pass 2 — Level cascade (floor groups)
 *   Pass 3 — Roof logic  ← MUST be last
 */

import * as THREE from "three";
import { PhaseId } from "@/constants/phases";
import { ModelNodeGroups, MaterialLibraryEntry } from "@/types/database";
import { capTextureSize } from "./cap-texture-size";

export type LevelId = 1 | 2 | 3;

const DEFAULT_NODE_GROUPS: Required<ModelNodeGroups> = {
  roof:   "Global_Roof_Group",
  level1: "Level_One_Group",
  level2: "Level_Two_Group",
  level3: "Level_Three_Group",
};

export interface StructuralNodeArrays {
  roofNodes?: string[];
  level1Nodes?: string[];
  level2Nodes?: string[];
  level3Nodes?: string[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Set visibility of all objects matching name (traverses full scene). */
function setVisible(scene: THREE.Object3D, name: string, visible: boolean) {
  scene.traverse((obj) => {
    if (obj.name === name) obj.visible = visible;
  });
}

/** Set visibility for a structural role: uses explicit mesh array if provided, else falls back to group name. */
function setStructuralVisible(
  scene: THREE.Object3D,
  meshNames: string[] | undefined,
  groupName: string,
  visible: boolean,
) {
  if (meshNames && meshNames.length > 0) {
    for (const name of meshNames) setVisible(scene, name, visible);
  } else {
    setVisible(scene, groupName, visible);
  }
}

/** Find a single mesh by name. */
export function findMesh(scene: THREE.Object3D, name: string): THREE.Mesh | null {
  let found: THREE.Mesh | null = null;
  scene.traverse((obj) => {
    if (!found && obj.name === name && obj instanceof THREE.Mesh) found = obj;
  });
  return found;
}

/** Collect all mesh names in the scene (for scene editor). */
export function collectMeshNames(scene: THREE.Object3D): string[] {
  const names: string[] = [];
  scene.traverse((obj) => {
    if (obj instanceof THREE.Mesh && obj.name) names.push(obj.name);
  });
  return [...new Set(names)];
}

/** Build a scene tree for the admin scene editor. */
export interface SceneTreeNode {
  name: string;
  type: string;
  children: SceneTreeNode[];
}

export function buildSceneTree(obj: THREE.Object3D): SceneTreeNode {
  return {
    name: obj.name || "(unnamed)",
    type: obj.type,
    children: obj.children.map(buildSceneTree),
  };
}

// ─── Visibility pass ──────────────────────────────────────────────────────────

export function applyR3FVisibility(
  scene: THREE.Object3D,
  phase: PhaseId,
  level: LevelId,
  nodeGroups: ModelNodeGroups = {},
  /**
   * Node names that belong to the currently-selected options.
   * Pass `null` when option seeding hasn't completed yet — this skips Pass 1
   * entirely so the GLB's default visibility is preserved until real selections
   * are available (avoids a "everything hidden" flash on first load).
   * Pass `[]` once seeded: any option node not in the selected set is hidden.
   */
  selectedOptions: string[] | null = null,
  allOptionNodes: string[] = [],
  structuralArrays: StructuralNodeArrays = {},
): void {
  if (!phase) return;

  const nodes = { ...DEFAULT_NODE_GROUPS, ...nodeGroups } as Required<ModelNodeGroups>;

  const showLevel2 = phase === "exterior" || phase === "interior" || level >= 2;
  const showLevel3 = phase === "exterior" || phase === "interior" || level >= 3;
  const showRoof   = phase !== "blueprint";

  // ── Pass 1: Level logic ──────────────────────────────────────────────────────
  setStructuralVisible(scene, structuralArrays.level1Nodes, nodes.level1, true);
  setStructuralVisible(scene, structuralArrays.level2Nodes, nodes.level2, showLevel2);
  setStructuralVisible(scene, structuralArrays.level3Nodes, nodes.level3, showLevel3);

  // ── Pass 2: Roof logic ───────────────────────────────────────────────────────
  setStructuralVisible(scene, structuralArrays.roofNodes, nodes.roof, showRoof);

  // ── Pass 3: option-driven visibility ────────────────────────────────────────
  // Runs after structural so option logic wins for level-1 meshes shared between
  // structuralArrays and allOptionNodes (e.g. Level_1_Front_Load vs Side_Load).
  // Container group names are excluded so they can't be accidentally option-hidden.
  // Skipped when selectedOptions is null (options not seeded yet).
  if (selectedOptions !== null && allOptionNodes.length > 0) {
    const containerNames = new Set<string>([nodes.roof, nodes.level1, nodes.level2, nodes.level3]);
    const selectedSet = new Set(selectedOptions);
    for (const nodeName of allOptionNodes) {
      if (containerNames.has(nodeName)) continue;
      setVisible(scene, nodeName, selectedSet.has(nodeName));
    }
  }

  // ── Pass 4: re-enforce structural HIDE — always wins ────────────────────────
  // Pass 3 may have re-shown level2/3/roof meshes that are also in allOptionNodes.
  // Force-hide any structural mesh that the level/phase logic said should be hidden.
  if (!showLevel2) for (const n of structuralArrays.level2Nodes ?? []) setVisible(scene, n, false);
  if (!showLevel3) for (const n of structuralArrays.level3Nodes ?? []) setVisible(scene, n, false);
  if (!showRoof)   for (const n of structuralArrays.roofNodes   ?? []) setVisible(scene, n, false);
}

// ─── UV Projection shader injection ──────────────────────────────────────────
// Mirrors the admin SceneEditorViewport.applyProjection — keeps frontend parity.

export function applyProjection(
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
  const sx = (scaleX !== undefined ? 1 / Math.max(scaleX, 0.001) : scale).toFixed(6);
  const sy = (scaleY !== undefined ? 1 / Math.max(scaleY, 0.001) : scale).toFixed(6);
  const sz = (scaleZ !== undefined ? 1 / Math.max(scaleZ, 0.001) : scale).toFixed(6);
  const ox = (offsetX ?? 0).toFixed(6);
  const oy = (offsetY ?? 0).toFixed(6);
  const oz = (offsetZ ?? 0).toFixed(6);
  const rot = (((rotationDeg ?? 0) * Math.PI) / 180).toFixed(6);

  const vertDecl = `varying vec3 v_wPos; varying vec3 v_wNrm;`;
  const vertMain = `v_wPos=(modelMatrix*vec4(position,1.)).xyz; v_wNrm=normalize((modelMatrix*vec4(normal,0.)).xyz);`;

  let fragDecl: string;
  let mapReplace: string;

  if (projection === "triplanar") {
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
    const uv = projection === "planar-top"   ? "v_wPos.xz"
             : projection === "planar-front" ? "v_wPos.xy"
             :                                 "v_wPos.yz";
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

// ─── Material override pass ───────────────────────────────────────────────────

// Cache for created materials to avoid re-allocating on every render
const materialCache = new Map<string, THREE.MeshPhysicalMaterial>();

export function applyMaterialOverride(
  scene: THREE.Object3D,
  meshNames: string[],
  entry: MaterialLibraryEntry,
) {
  const propsKey = entry.properties ? JSON.stringify(entry.properties) : "";
  const cacheKey  = `${entry.id}:${entry.base_color}:${entry.roughness}:${entry.metalness}:${propsKey}`;
  let mat = materialCache.get(cacheKey);

  if (!mat) {
    const p = entry.properties ?? {};
    const loader = new THREE.TextureLoader();
    const projection = p.uvProjection ?? "uv";
    const worldScale = 1 / Math.max(p.uvScale ?? 1, 0.001);

    // Show base_color as placeholder while textures download instead of black.
    // When the albedo map arrives and !colorTint, update color to white so the
    // texture renders at full brightness (same logic as the synchronous path).
    const baseColor = new THREE.Color(entry.base_color);
    const brightness = p.albedoBrightness ?? 1;
    if (brightness !== 1) baseColor.multiplyScalar(brightness);

    mat = new THREE.MeshPhysicalMaterial({
      color: baseColor,
      roughness: entry.roughness,
      metalness: entry.metalness,
      opacity:      p.opacity ?? 1,
      transparent:  (p.opacity ?? 1) < 1 || (p.transmission ?? 0) > 0,
      ior:          p.ior ?? 1.5,
      clearcoat:    p.clearcoat ?? 0,
      clearcoatRoughness: p.clearcoatRoughness ?? 0,
      transmission: p.transmission ?? 0,
    });

    // Capture mat in closure so callbacks always reference the same object
    const m = mat;

    function loadDeferred(
      url: string | null | undefined,
      slot: "map" | "normalMap" | "bumpMap" | "roughnessMap" | "metalnessMap" | "aoMap",
      srgb = false,
    ) {
      if (!url) return;
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
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (m as any)[slot] = loaded;
        if (slot === "map" && !p.colorTint) {
          // Albedo tex provides color — switch from placeholder tint to white
          m.color.set("#ffffff");
          if (brightness !== 1) m.color.multiplyScalar(brightness);
        }
        if (slot === "normalMap") m.normalScale.set(p.normalScale ?? 1, p.normalScale ?? 1);
        if (slot === "bumpMap")   m.bumpScale = p.bumpScale ?? 0.05;
        if (slot === "aoMap")     m.aoMapIntensity = p.aoIntensity ?? 1;
        m.needsUpdate = true;
      });
    }

    loadDeferred(p.albedoMapUrl,    "map",          true);
    loadDeferred(p.normalMapUrl,    "normalMap");
    loadDeferred(p.bumpMapUrl,      "bumpMap");
    loadDeferred(p.roughnessMapUrl, "roughnessMap");
    loadDeferred(p.metalnessMapUrl, "metalnessMap");
    loadDeferred(p.aoMapUrl,        "aoMap");

    mat.envMapIntensity = 1.0;
    if (p.emissiveColor && (p.emissiveIntensity ?? 0) > 0) {
      mat.emissive.set(p.emissiveColor);
      mat.emissiveIntensity = p.emissiveIntensity ?? 0;
    }

    // Set up projection shader immediately — texture slot will be filled async.
    // Check URL presence rather than mat.map since that's still null at this point.
    if (projection !== "uv" && p.albedoMapUrl) {
      applyProjection(mat, projection, worldScale, p.uvScaleX, p.uvScaleY, p.uvScaleZ, p.uvTriOffsetX, p.uvTriOffsetY, p.uvTriOffsetZ, p.uvTriRotation);
    }

    materialCache.set(cacheKey, mat);
  }

  for (const name of meshNames) {
    const mesh = findMesh(scene, name);
    if (mesh) mesh.material = mat!;
  }
}

/**
 * Pre-populate materialCache and start texture downloads for every entry,
 * without touching any scene mesh.  Call this right after the model loads so
 * textures are already in-flight by the time the user switches phases.
 */
export function warmUpMaterialCache(entries: MaterialLibraryEntry[]): void {
  for (const entry of entries) {
    const propsKey = entry.properties ? JSON.stringify(entry.properties) : "";
    const cacheKey = `${entry.id}:${entry.base_color}:${entry.roughness}:${entry.metalness}:${propsKey}`;
    if (materialCache.has(cacheKey)) continue;
    // Empty meshNames → creates + caches the material, starts texture loads, assigns nothing.
    applyMaterialOverride(_dummyScene, [], entry);
  }
}
const _dummyScene = new THREE.Object3D();

/** Restore original materials for meshes (stored before override). */
const originalMaterials = new Map<string, THREE.Material | THREE.Material[]>();

export function captureOriginalMaterials(scene: THREE.Object3D, meshNames: string[]) {
  for (const name of meshNames) {
    if (originalMaterials.has(name)) continue;
    const mesh = findMesh(scene, name);
    if (mesh) originalMaterials.set(name, mesh.material);
  }
}

export function restoreOriginalMaterials(scene: THREE.Object3D, meshNames: string[]) {
  for (const name of meshNames) {
    const orig = originalMaterials.get(name);
    if (!orig) continue;
    const mesh = findMesh(scene, name);
    if (mesh) mesh.material = orig as THREE.Material;
  }
}

// ─── KHR_materials_variants activation ───────────────────────────────────────

export function applyGltfVariant(
  scene: THREE.Object3D,
  variantName: string,
  meshNames: string[],
) {
  // drei's useGLTF stores variant data in mesh.userData.gltfExtensions
  for (const name of meshNames) {
    const mesh = findMesh(scene, name);
    if (!mesh) continue;

    const variants: Array<{ name: string; material: THREE.Material }> =
      mesh.userData?.gltfExtensions?.KHR_materials_variants?.mappings ?? [];

    const match = variants.find((v) => v.name === variantName);
    if (match) mesh.material = match.material;
  }
}
