"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { useGLTF, Environment, OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import { ACESFilmicToneMapping, SRGBColorSpace } from "three";
import { buildSceneTree, type SceneTreeNode } from "@/lib/three/variant-engine";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";

interface SceneLoaderProps {
  modelUrl: string;
  selectedMeshName: string | null;
  onMeshClick: (name: string) => void;
  onSceneLoaded: (tree: SceneTreeNode[]) => void;
}

// Map to preserve original materials before highlight overrides
const originalMats = new Map<string, THREE.Material | THREE.Material[]>();

function SceneLoader({ modelUrl, selectedMeshName, onMeshClick, onSceneLoaded }: SceneLoaderProps) {
  const { scene } = useGLTF(modelUrl);
  const { camera } = useThree();
  const orbitRef    = useRef<OrbitControlsImpl>(null);
  const reportedRef = useRef(false);

  const [clone, setClone] = useState<THREE.Group | null>(null);

  // Clone scene once per URL and fit camera
  useEffect(() => {
    const cloned = scene.clone(true);
    // Capture original materials
    originalMats.clear();
    cloned.traverse((obj) => {
      if (obj instanceof THREE.Mesh && obj.name) {
        originalMats.set(obj.name, Array.isArray(obj.material)
          ? obj.material.map(m => m.clone())
          : obj.material.clone());
      }
    });
    setClone(cloned);
    reportedRef.current = false;
  }, [modelUrl]); // eslint-disable-line react-hooks/exhaustive-deps

  // Report scene tree after clone is ready (onSceneLoaded intentionally excluded —
  // stabilized via useCallback in parent; including it would re-fire on every render)
  useEffect(() => {
    if (!clone || reportedRef.current) return;
    reportedRef.current = true;
    onSceneLoaded(buildSceneTree(clone).children);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clone]);

  // Fit camera after clone is ready
  useEffect(() => {
    if (!clone) return;
    const box    = new THREE.Box3().setFromObject(clone);
    const center = box.getCenter(new THREE.Vector3());
    const size   = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z) || 1;
    camera.position.set(center.x, center.y + maxDim * 0.5, center.z + maxDim * 1.8);
    if (camera instanceof THREE.PerspectiveCamera) {
      camera.near = maxDim * 0.001;
      camera.far  = maxDim * 100;
      camera.updateProjectionMatrix();
    }
    if (orbitRef.current) {
      orbitRef.current.target.copy(center);
      orbitRef.current.update();
    }
  }, [clone, camera]);

  // Apply / restore highlight material when selection changes
  useEffect(() => {
    if (!clone) return;
    clone.traverse((obj) => {
      if (!(obj instanceof THREE.Mesh) || !obj.name) return;
      if (obj.name === selectedMeshName) {
        obj.material = new THREE.MeshStandardMaterial({
          color: new THREE.Color("#3b82f6"),
          emissive: new THREE.Color("#1d4ed8"),
          emissiveIntensity: 0.3,
          transparent: true,
          opacity: 0.85,
        });
      } else {
        const orig = originalMats.get(obj.name);
        if (orig) obj.material = orig as THREE.Material;
      }
    });
  }, [clone, selectedMeshName]);

  function handlePointerDown(e: { stopPropagation: () => void; object: THREE.Object3D }) {
    e.stopPropagation();
    let obj: THREE.Object3D | null = e.object;
    while (obj && !(obj instanceof THREE.Mesh && obj.name)) obj = obj.parent;
    if (obj?.name) onMeshClick(obj.name);
  }

  return (
    <>
      <OrbitControls ref={orbitRef} makeDefault />
      {clone && (
        <primitive object={clone} onPointerDown={handlePointerDown} />
      )}
    </>
  );
}

interface SceneEditorCanvasProps {
  modelUrl: string;
  selectedMeshName: string | null;
  onMeshClick: (name: string) => void;
  onSceneLoaded: (tree: SceneTreeNode[]) => void;
}

export default function SceneEditorCanvas({
  modelUrl, selectedMeshName, onMeshClick, onSceneLoaded,
}: SceneEditorCanvasProps) {
  return (
    <div className="w-full h-full bg-[#0d0d0d] rounded-xl overflow-hidden">
      <Canvas
        dpr={[1, 2]}
        camera={{ position: [8, 6, 12], fov: 45, near: 0.01, far: 1000 }}
        gl={{
          antialias: true,
          alpha: false,
          toneMapping: ACESFilmicToneMapping,
          toneMappingExposure: 1.1,
          outputColorSpace: SRGBColorSpace,
        }}
        onCreated={({ gl }) => gl.setClearColor("#0d0d0d", 1)}
      >
        <color attach="background" args={["#0d0d0d"]} />
        <Suspense fallback={null}>
          <SceneLoader
            modelUrl={modelUrl}
            selectedMeshName={selectedMeshName}
            onMeshClick={onMeshClick}
            onSceneLoaded={onSceneLoaded}
          />
        </Suspense>
        <Environment preset="apartment" />
        <ambientLight intensity={0.3} />
        <directionalLight position={[10, 12, 8]} intensity={0.7} />
      </Canvas>
    </div>
  );
}
