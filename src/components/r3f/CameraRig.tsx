"use client";

/**
 * Camera controller for the R3F configurator.
 * Exposes a SketchfabCameraApi-compatible imperative handle so
 * ConfiguratorClient and QuoteModal work with zero changes.
 *
 * Must render inside a <Canvas> — uses useThree() and CameraControls.
 */

import { useEffect, useRef } from "react";
import { useThree } from "@react-three/fiber";
import { CameraControls } from "@react-three/drei";
import * as THREE from "three";
import type { SketchfabCameraApi, CameraCoords } from "@/utils/sketchfab-camera";
import type { SceneRenderSettings } from "@/types/database";
import { exportCanvas } from "@/lib/three/canvas-export";

interface CameraRigProps {
  initialCamera?: CameraCoords;
  settings?: SceneRenderSettings;
  onApiReady?: (api: SketchfabCameraApi) => void;
}

export default function CameraRig({ initialCamera, settings, onApiReady }: CameraRigProps) {
  const controlsRef = useRef<CameraControls>(null);
  const { gl, camera, scene } = useThree();
  const apiReportedRef = useRef(false);

  useEffect(() => {
    if (initialCamera && controlsRef.current) {
      const [px, py, pz] = initialCamera.pos ?? [8, 6, 12];
      const [tx, ty, tz] = initialCamera.target ?? [0, 2, 0];
      controlsRef.current.setLookAt(px, py, pz, tx, ty, tz, false);
      if (initialCamera.fov && camera instanceof THREE.PerspectiveCamera) {
        camera.fov = initialCamera.fov;
        camera.updateProjectionMatrix();
      }
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Apply scene settings camera controls
  useEffect(() => {
    if (!(camera instanceof THREE.PerspectiveCamera)) return;
    camera.fov = settings?.cameraFov ?? 45;
    camera.updateProjectionMatrix();
  }, [camera, settings?.cameraFov]);

  useEffect(() => {
    if (apiReportedRef.current) return;
    apiReportedRef.current = true;

    const api: SketchfabCameraApi = {
      setCameraLookAt(
        pos: [number, number, number],
        target: [number, number, number],
        _duration: number,
      ) {
        controlsRef.current?.setLookAt(
          pos[0], pos[1], pos[2],
          target[0], target[1], target[2],
          true, // enableTransition — smooth lerp
        );
      },

      setFov(fov: number) {
        if (camera instanceof THREE.PerspectiveCamera) {
          camera.fov = fov;
          camera.updateProjectionMatrix();
        }
      },

      getScreenShot(_w: number, _h: number, cb: (err: unknown, result: string) => void) {
        try {
          // Render one frame to ensure the canvas is up-to-date
          gl.render(scene, camera);
          const dataUrl = exportCanvas(gl, { format: "jpeg", quality: 0.92 });
          cb(null, dataUrl);
        } catch (err) {
          cb(err, "");
        }
      },
    };

    onApiReady?.(api);
  }, [camera, gl, onApiReady, scene]);

  const architectural = settings?.architecturalMode ?? false;

  return (
    <CameraControls
      ref={controlsRef}
      makeDefault
      minDistance={2}
      maxDistance={80}
      minPolarAngle={architectural ? Math.PI / 2 : 0.1}
      maxPolarAngle={architectural ? Math.PI / 2 : Math.PI / 2.1}
      azimuthRotateSpeed={settings?.rotateSpeed ?? 1}
      polarRotateSpeed={architectural ? 0 : (settings?.rotateSpeed ?? 1)}
      truckSpeed={settings?.panSpeed ?? 1}
      dollySpeed={settings?.zoomSpeed ?? 1}
      smoothTime={0.35}
      draggingSmoothTime={0.1}
    />
  );
}
