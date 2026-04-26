"use client";

/**
 * R3F-based GLB viewer for the admin GLB Compressor page.
 * Parent manages the blob URL; this component only renders.
 */

import { Suspense, useEffect, useRef } from "react";
import { Canvas, useLoader } from "@react-three/fiber";
import { OrbitControls, Environment, Grid, Bounds, useBounds } from "@react-three/drei";
import { GLTFLoader, DRACOLoader } from "three-stdlib";
import type { GLTF } from "three-stdlib";
import * as THREE from "three";

// Draco decoder (same CDN used elsewhere in the project)
const _draco = new DRACOLoader();
_draco.setDecoderPath("https://www.gstatic.com/draco/versioned/decoders/1.5.5/");
_draco.preload();

export interface ModelInfo {
  meshCount: number;
  primCount: number;
  vertCount: number;
  triCount: number;
  nodes: NodeEntry[];
}

export interface NodeEntry {
  name: string;
  isMesh: boolean;
  depth: number;
  vertCount?: number;
}

interface ViewerProps {
  url: string | null;          // blob URL managed by the page
  wireframe?: boolean;
  gridVisible?: boolean;
  resetKey?: number;           // increment to refit camera
  onModelLoad?: (info: ModelInfo) => void;
}

// ── Model (inside Canvas) ─────────────────────────────────────────────────────

function Model({
  url,
  wireframe,
  onLoad,
}: {
  url: string;
  wireframe: boolean;
  onLoad?: (info: ModelInfo) => void;
}) {
  const gltf = useLoader(GLTFLoader, url, (loader) => {
    (loader as GLTFLoader).setDRACOLoader(_draco);
  }) as GLTF;

  const bounds  = useBounds();
  const didFit  = useRef(false);

  // Auto-fit once after load
  useEffect(() => {
    if (didFit.current) return;
    didFit.current = true;
    bounds.refresh(gltf.scene).clip().fit();

    if (!onLoad) return;

    let meshCount = 0, primCount = 0, vertCount = 0, triCount = 0;
    const nodes: NodeEntry[] = [];

    function walk(obj: THREE.Object3D, depth: number) {
      const mesh = obj as THREE.Mesh;
      if (obj.name || mesh.isMesh) {
        const v = mesh.isMesh ? (mesh.geometry.attributes.position?.count ?? 0) : 0;
        nodes.push({ name: obj.name || (mesh.isMesh ? "(mesh)" : "(node)"), isMesh: mesh.isMesh, depth, vertCount: v });
        if (mesh.isMesh) {
          meshCount++;
          primCount++;
          vertCount += v;
          if (mesh.geometry.index) triCount += mesh.geometry.index.count / 3;
          else triCount += v / 3;
        }
      }
      for (const child of obj.children) walk(child, depth + 1);
    }
    walk(gltf.scene, 0);

    onLoad({ meshCount, primCount, vertCount, triCount: Math.round(triCount), nodes });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gltf]);

  // Sync wireframe to materials
  useEffect(() => {
    gltf.scene.traverse((obj) => {
      if (!(obj as THREE.Mesh).isMesh) return;
      const mats = Array.isArray((obj as THREE.Mesh).material)
        ? (obj as THREE.Mesh).material as THREE.MeshStandardMaterial[]
        : [(obj as THREE.Mesh).material as THREE.MeshStandardMaterial];
      mats.forEach((m) => { m.wireframe = wireframe; });
    });
  }, [gltf, wireframe]);

  return <primitive object={gltf.scene} />;
}

// Re-fits bounds when resetKey changes
function ResetTrigger({ resetKey }: { resetKey: number }) {
  const bounds = useBounds();
  const prev   = useRef(resetKey);
  useEffect(() => {
    if (resetKey !== prev.current) {
      prev.current = resetKey;
      bounds.refresh().clip().fit();
    }
  });
  return null;
}

// ── Grid ──────────────────────────────────────────────────────────────────────

function SceneGrid({ visible }: { visible: boolean }) {
  return visible ? (
    <Grid
      args={[20, 20]}
      cellSize={0.5}
      cellThickness={0.3}
      cellColor="#222222"
      sectionSize={2}
      sectionColor="#2e2e2e"
      sectionThickness={0.6}
      fadeDistance={25}
      fadeStrength={1}
      position={[0, -0.001, 0]}
    />
  ) : null;
}

// ── Public component ──────────────────────────────────────────────────────────

export default function GlbCompressorViewer({
  url,
  wireframe = false,
  gridVisible = true,
  resetKey = 0,
  onModelLoad,
}: ViewerProps) {
  return (
    <Canvas
      camera={{ fov: 45, near: 0.01, far: 2000, position: [4, 3, 4] }}
      gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.1 }}
      onCreated={({ gl }) => gl.setClearColor(new THREE.Color(0x0d0d0d))}
      style={{ width: "100%", height: "100%" }}
    >
      <Environment preset="city" />
      <SceneGrid visible={gridVisible} />
      <OrbitControls makeDefault enableDamping dampingFactor={0.06} />

      {url && (
        // key=url remounts Bounds (and child) whenever URL changes → fresh fit
        <Bounds fit clip observe margin={1.4} key={url}>
          <ResetTrigger resetKey={resetKey} />
          <Suspense fallback={null}>
            <Model url={url} wireframe={wireframe} onLoad={onModelLoad} />
          </Suspense>
        </Bounds>
      )}
    </Canvas>
  );
}
