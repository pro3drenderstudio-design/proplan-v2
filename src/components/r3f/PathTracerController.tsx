"use client";

import { useEffect, useRef } from "react";
import { useThree, useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { WebGLPathTracer } from "three-gpu-pathtracer";

export type PTState = "off" | "building" | "waiting" | "rendering" | "done" | "error";
export interface PTStatus {
  state: PTState;
  // rendering: sample count; building: progress 0-100; error: 0
  samples: number;
}

interface PathTracerControllerProps {
  enabled: boolean;
  bounces?: number;
  sceneVersion?: number;
  idleMs?: number;
  onStatus?: (s: PTStatus) => void;
}

/**
 * Build a flat Scene containing only MeshStandardMaterial / MeshPhysicalMaterial
 * objects with their world transforms baked in. This excludes ShaderMaterial
 * gizmos, the drei Grid, TransformControls helpers, and any other non-PBR
 * geometry that would either hang the BVH builder or produce garbage output.
 */
function buildPTScene(source: THREE.Scene): THREE.Scene {
  const ptScene = new THREE.Scene();
  ptScene.background  = source.background;
  ptScene.environment = source.environment;

  source.traverse((obj) => {
    if (!(obj instanceof THREE.Mesh) || !obj.visible) return;

    const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
    const allPBR = mats.every(
      (m) => m instanceof THREE.MeshStandardMaterial || m instanceof THREE.MeshPhysicalMaterial,
    );
    if (!allPBR) return;

    const geo = obj.geometry as THREE.BufferGeometry;
    if (!geo || !geo.attributes.position) return;

    // Skip degenerate / empty geometry
    const posCount = geo.attributes.position.count;
    if (posCount < 3) return;

    // Skip oversized planes used as ground/grid backdrops (> 1000 world units)
    if (geo instanceof THREE.PlaneGeometry) {
      if (!geo.boundingBox) geo.computeBoundingBox();
      const ws = obj.getWorldScale(new THREE.Vector3());
      const bb = geo.boundingBox!;
      const sx = (bb.max.x - bb.min.x) * ws.x;
      const sz = (bb.max.z - bb.min.z) * ws.z;
      if (sx > 1000 || sz > 1000) return;
    }

    // Shallow proxy: shares geometry + materials, bakes world matrix
    const proxy = new THREE.Mesh(geo, obj.material);
    obj.updateWorldMatrix(true, false);
    proxy.matrixAutoUpdate = false;
    proxy.matrix.copy(obj.matrixWorld);
    proxy.matrixWorld.copy(obj.matrixWorld);
    proxy.castShadow    = obj.castShadow;
    proxy.receiveShadow = obj.receiveShadow;
    ptScene.add(proxy);
  });

  return ptScene;
}

const BUILD_TIMEOUT_MS = 30_000;

export default function PathTracerController({
  enabled,
  bounces = 4,
  sceneVersion = 0,
  idleMs = 800,
  onStatus,
}: PathTracerControllerProps) {
  const { gl, scene, camera } = useThree();

  const ptRef         = useRef<WebGLPathTracer | null>(null);
  const builtRef      = useRef(false);
  const buildingRef   = useRef(false);
  const idleRef       = useRef(false);
  const samplesRef    = useRef(0);
  const timerRef      = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastCamRef    = useRef("");
  const onStatusRef   = useRef(onStatus);
  onStatusRef.current = onStatus;

  function report(state: PTState, samples = 0) {
    onStatusRef.current?.({ state, samples });
  }

  // Create / destroy path tracer
  useEffect(() => {
    if (!enabled) {
      if (timerRef.current) clearTimeout(timerRef.current);
      ptRef.current?.dispose();
      ptRef.current       = null;
      builtRef.current    = false;
      buildingRef.current = false;
      idleRef.current     = false;
      samplesRef.current  = 0;
      report("off");
      return;
    }

    const pt = new WebGLPathTracer(gl);
    pt.bounces                   = bounces;
    pt.filterGlossyFactor        = 0.5;
    pt.multipleImportanceSampling = true;
    ptRef.current    = pt;
    builtRef.current = false;

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      pt.dispose();
      ptRef.current = null;
    };
  }, [enabled, gl]); // eslint-disable-line react-hooks/exhaustive-deps

  // Rebuild BVH on scene change
  useEffect(() => {
    const pt = ptRef.current;
    if (!enabled || !pt || buildingRef.current) return;

    builtRef.current    = false;
    idleRef.current     = false;
    samplesRef.current  = 0;
    buildingRef.current = true;
    report("building", 0);

    // Filter scene to PBR-only meshes before handing to BVH builder
    const ptScene = buildPTScene(scene);
    const meshCount = ptScene.children.length;
    console.log(`[PathTracer] building BVH over ${meshCount} PBR mesh(es)…`);

    let cancelled = false;

    // Timeout guard — surface an error instead of hanging indefinitely
    const timeoutId = setTimeout(() => {
      if (!cancelled) {
        cancelled = true;
        buildingRef.current = false;
        report("error");
        console.error("[PathTracer] BVH build timed out after 30s");
      }
    }, BUILD_TIMEOUT_MS);

    pt.setSceneAsync(ptScene, camera, {
      onProgress: (p: number) => {
        if (!cancelled) report("building", Math.round(p * 100));
      },
    })
      .then(() => {
        clearTimeout(timeoutId);
        if (!cancelled) {
          builtRef.current    = true;
          buildingRef.current = false;
          report("waiting");
          console.log("[PathTracer] BVH ready — waiting for idle");
        }
      })
      .catch((err: unknown) => {
        clearTimeout(timeoutId);
        if (!cancelled) {
          buildingRef.current = false;
          report("error");
          console.error("[PathTracer] setSceneAsync failed:", err);
        }
      });

    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
      buildingRef.current = false;
    };
  }, [enabled, sceneVersion]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (ptRef.current) ptRef.current.bounces = bounces;
  }, [bounces]);

  // Per-frame: idle detection + progressive accumulation
  useFrame(({ camera: frameCam, gl: frameGl }) => {
    if (!enabled || !ptRef.current || !builtRef.current) return;

    const el     = frameCam.matrixWorld.elements;
    const camKey = `${el[8].toFixed(3)},${el[9].toFixed(3)},${el[10].toFixed(3)},${el[12].toFixed(3)},${el[13].toFixed(3)},${el[14].toFixed(3)}`;

    if (camKey !== lastCamRef.current) {
      lastCamRef.current = camKey;
      if (samplesRef.current > 0) {
        ptRef.current.reset();
        samplesRef.current = 0;
      }
      idleRef.current = false;
      if (timerRef.current) clearTimeout(timerRef.current);
      report("waiting");
      timerRef.current = setTimeout(() => {
        idleRef.current = true;
        console.log("[PathTracer] idle — starting accumulation");
      }, idleMs);
      return;
    }

    if (!idleRef.current) return;
    if (samplesRef.current >= 1024) return;

    if (samplesRef.current === 0) {
      ptRef.current.setCamera(frameCam);
      frameGl.setRenderTarget(null);
    }

    ptRef.current.renderSample();
    samplesRef.current++;

    const n = samplesRef.current;
    if (n === 1)   console.log("[PathTracer] first sample rendered — check viewport");
    if (n === 16)  console.log("[PathTracer] 16 samples");
    if (n === 128) console.log("[PathTracer] 128 samples — should look clean");

    report(n >= 1024 ? "done" : "rendering", n);
  }, 1);

  return null;
}
