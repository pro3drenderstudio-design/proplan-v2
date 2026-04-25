"use client";

/**
 * Frontend scene environment — mirrors SceneEditorViewport's EditorScene lighting
 * section exactly. Merges incoming SceneRenderSettings (all optional) with the same
 * defaults used by DEFAULT_SCENE_SETTINGS in the admin, so both render identically.
 */

import { useEffect, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Environment, Sky, Stars, Cloud, Clouds } from "@react-three/drei";
import { EffectComposer, N8AO, Bloom, SMAA, BrightnessContrast } from "@react-three/postprocessing";
import { BlendFunction } from "postprocessing";
import * as THREE from "three";
import type { SceneRenderSettings } from "@/types/database";

// Mirrors DEFAULT_SCENE_SETTINGS from SceneEditorViewport.tsx
const DEFAULTS = {
  envLightType:             "preset" as const,
  envLightPreset:           "apartment",
  envLightHdriUrl:          "",
  hdriIntensity:            1,
  hdriBackgroundBrightness: 1,
  hdriRotation:             0,
  hdriContrast:             0,
  bgType:                   "color" as const,
  bgColor:                  "#0d0d0d",
  ambientIntensity:         0.4,
  sunIntensity:             2.2,
  sunColor:                 "#fff4e0",
  sunElevationDeg:          42,
  sunAzimuthDeg:            45,
  sunDistance:              18,
  shadows:                  true,
  shadowRadius:             3,
  skyDomeLights:            true,
  skyDomeLightIntensity:    0.5,
  skyDomeLightColor:        "#e8f0fa",
  skyDomeLightShadows:      false,
  ssao:                     true,
  bloom:                    true,
  groundPlane:              false,
  groundColor:              "#2a2a2a",
  skyTurbidity:             4.5,
  skyRayleigh:              2.5,
  skyMieCoeff:              0.003,
  skyMieDirectionalG:       0.92,
  skyRotation:              0,
  skyBrightness:            1,
  showStars:                false,
  showClouds:               false,
  cloudOpacity:             0.6,
  cloudSpeed:               0.2,
  cloudColor:               "#ffffff",
  cloudHeight:              60,
  cloudCount:               5,
  fogEnabled:               false,
  fogColor:                 "#b8d0e8",
  fogNear:                  40,
  fogFar:                   200,
  aoRadius:                 3,
  aoSamples:                16,
  aoIntensity:              5,
  aaMode:                   "smaa" as const,
  pathTracing:              false,
  pathTracingBounces:       4,
};

// Same helper used in SceneEditorViewport.tsx
function sunToXYZ(elev: number, azim: number, dist: number): [number, number, number] {
  const e = (elev * Math.PI) / 180;
  const a = (azim * Math.PI) / 180;
  return [
    dist * Math.cos(e) * Math.sin(a),
    dist * Math.sin(e),
    dist * Math.cos(e) * Math.cos(a),
  ];
}

interface EnvironmentSetupProps {
  settings?: SceneRenderSettings;
  preset?: string;
  lowPerf?: boolean;
  // When path tracing is actively rendering, suppress the postprocessing stack
  skipEffects?: boolean;
}

export default function EnvironmentSetup({ settings, preset = "apartment", lowPerf = false, skipEffects = false }: EnvironmentSetupProps) {
  // Merge with defaults so every field is guaranteed defined — same as admin which
  // always has all fields via DEFAULT_SCENE_SETTINGS.
  const s = { ...DEFAULTS, envLightPreset: preset, ...settings };

  const skyRotRad = (s.skyRotation * Math.PI) / 180;
  const sunPos    = sunToXYZ(s.sunElevationDeg, s.sunAzimuthDeg + s.skyRotation, s.sunDistance);
  const envPreset = s.envLightPreset as Parameters<typeof Environment>[0]["preset"];

  const el = (s.sunElevationDeg * Math.PI) / 180;
  const az = (s.sunAzimuthDeg   * Math.PI) / 180 + skyRotRad;
  const skySunPos: [number, number, number] = [
    Math.cos(el) * Math.sin(az),
    Math.sin(el),
    Math.cos(el) * Math.cos(az),
  ];

  // Gate the EffectComposer so it never mounts while the WebGL context is
  // unavailable. postprocessing's EffectComposer.addPass calls
  // getContextAttributes().alpha without a null guard — if the context is
  // transiently lost (GPU pressure during model upload) this throws and
  // crashes the whole React tree.
  const { gl } = useThree();
  const [effectsReady, setEffectsReady] = useState(false);

  // Initial readiness: wait until the context confirms it is stable.
  useEffect(() => {
    let cancelled = false;
    let raf: number;

    function tryEnable() {
      if (cancelled) return;
      try {
        const attrs = gl.getContext()?.getContextAttributes();
        if (attrs != null) {
          setEffectsReady(true);
        } else {
          raf = requestAnimationFrame(tryEnable);
        }
      } catch {
        raf = requestAnimationFrame(tryEnable);
      }
    }

    raf = requestAnimationFrame(() => requestAnimationFrame(tryEnable));
    return () => { cancelled = true; cancelAnimationFrame(raf); };
  }, [gl]); // eslint-disable-line react-hooks/exhaustive-deps

  // If the context is lost while effects are already mounted, tear them down
  // immediately so the EffectComposer doesn't try to render with a dead context.
  // Re-enable as soon as the context is restored and stable.
  useEffect(() => {
    const canvas = gl.domElement;

    function onLost() {
      setEffectsReady(false);
    }

    function onRestored() {
      let raf: number;
      function tryRestore() {
        try {
          const attrs = gl.getContext()?.getContextAttributes();
          if (attrs != null) { setEffectsReady(true); return; }
        } catch { /* keep retrying */ }
        raf = requestAnimationFrame(tryRestore);
      }
      raf = requestAnimationFrame(() => requestAnimationFrame(tryRestore));
      return () => cancelAnimationFrame(raf);
    }

    canvas.addEventListener("webglcontextlost", onLost);
    canvas.addEventListener("webglcontextrestored", onRestored);
    return () => {
      canvas.removeEventListener("webglcontextlost", onLost);
      canvas.removeEventListener("webglcontextrestored", onRestored);
    };
  }, [gl]); // eslint-disable-line react-hooks/exhaustive-deps

  useFrame(({ gl: frameGl }) => {
    frameGl.toneMappingExposure = s.bgType === "sky" ? s.skyBrightness : 1.1;
  });

  return (
    <>
      {s.bgType === "color" && <color attach="background" args={[s.bgColor]} />}

      {s.bgType === "sky" && (
        <Sky distance={450000} sunPosition={skySunPos}
          turbidity={s.skyTurbidity} rayleigh={s.skyRayleigh}
          mieCoefficient={s.skyMieCoeff} mieDirectionalG={s.skyMieDirectionalG} />
      )}
      {s.bgType === "sky" && s.showStars && (
        <Stars radius={100} depth={50} count={5000} factor={4} saturation={0} fade speed={0.5} />
      )}
      {s.bgType === "sky" && s.showClouds && (
        <Clouds material={THREE.MeshLambertMaterial}>
          {Array.from({ length: s.cloudCount }).map((_, i) => {
            const angle = (i / s.cloudCount) * Math.PI * 2;
            const r = 200 + (i % 3) * 60;
            return (
              <Cloud key={i} seed={i + 1}
                position={[Math.cos(angle) * r, s.cloudHeight + (i % 3) * 20, Math.sin(angle) * r]}
                bounds={[100, 12, 100]} volume={80} segments={40}
                opacity={s.cloudOpacity} speed={s.cloudSpeed} color={s.cloudColor}
              />
            );
          })}
        </Clouds>
      )}

      {s.fogEnabled && <fog attach="fog" args={[s.fogColor, s.fogNear, s.fogFar]} />}

      {s.groundPlane && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]} receiveShadow>
          <planeGeometry args={[10000, 10000]} />
          <meshStandardMaterial color={s.groundColor} roughness={0.85} metalness={0} />
        </mesh>
      )}

      {s.envLightType === "preset" && (
        <Environment preset={envPreset} background={s.bgType === "env"}
          environmentIntensity={s.hdriIntensity} backgroundIntensity={s.hdriBackgroundBrightness}
          environmentRotation={[0, (s.hdriRotation * Math.PI) / 180, 0]}
          backgroundRotation={[0, (s.hdriRotation * Math.PI) / 180, 0]} />
      )}
      {s.envLightType === "hdri" && s.envLightHdriUrl && (
        <Environment files={s.envLightHdriUrl} background={s.bgType === "env"}
          environmentIntensity={s.hdriIntensity} backgroundIntensity={s.hdriBackgroundBrightness}
          environmentRotation={[0, (s.hdriRotation * Math.PI) / 180, 0]}
          backgroundRotation={[0, (s.hdriRotation * Math.PI) / 180, 0]} />
      )}
      {s.envLightType === "hdri" && !s.envLightHdriUrl && (
        <Environment preset={envPreset} background={s.bgType === "env"}
          environmentIntensity={s.hdriIntensity} backgroundIntensity={s.hdriBackgroundBrightness}
          environmentRotation={[0, (s.hdriRotation * Math.PI) / 180, 0]}
          backgroundRotation={[0, (s.hdriRotation * Math.PI) / 180, 0]} />
      )}

      <hemisphereLight args={["#c4d8f0", "#5a4a32", s.ambientIntensity]} />

      {/* Sun — exact same setup as admin, no lowPerf gate */}
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
      {/* Fill */}
      <directionalLight
        position={[-sunPos[0] * 0.5, sunPos[1] * 0.3, -sunPos[2] * 0.5]}
        intensity={s.sunIntensity * 0.15}
        color="#b8cce8"
      />

      {/* Sky dome lights — no lowPerf gate, matches admin exactly */}
      {s.skyDomeLights && (<>
        <directionalLight position={[ 12, 18,  0]} intensity={s.skyDomeLightIntensity} color={s.skyDomeLightColor} castShadow={s.shadows && s.skyDomeLightShadows} shadow-mapSize={[1024,1024]} shadow-camera-far={60} shadow-camera-left={-25} shadow-camera-right={25} shadow-camera-top={25} shadow-camera-bottom={-25} shadow-bias={-0.001} shadow-radius={s.shadowRadius * 0.6} />
        <directionalLight position={[-12, 18,  0]} intensity={s.skyDomeLightIntensity} color={s.skyDomeLightColor} castShadow={s.shadows && s.skyDomeLightShadows} shadow-mapSize={[1024,1024]} shadow-camera-far={60} shadow-camera-left={-25} shadow-camera-right={25} shadow-camera-top={25} shadow-camera-bottom={-25} shadow-bias={-0.001} shadow-radius={s.shadowRadius * 0.6} />
        <directionalLight position={[  0, 18, 12]} intensity={s.skyDomeLightIntensity} color={s.skyDomeLightColor} castShadow={s.shadows && s.skyDomeLightShadows} shadow-mapSize={[1024,1024]} shadow-camera-far={60} shadow-camera-left={-25} shadow-camera-right={25} shadow-camera-top={25} shadow-camera-bottom={-25} shadow-bias={-0.001} shadow-radius={s.shadowRadius * 0.6} />
        <directionalLight position={[  0, 18,-12]} intensity={s.skyDomeLightIntensity} color={s.skyDomeLightColor} castShadow={s.shadows && s.skyDomeLightShadows} shadow-mapSize={[1024,1024]} shadow-camera-far={60} shadow-camera-left={-25} shadow-camera-right={25} shadow-camera-top={25} shadow-camera-bottom={-25} shadow-bias={-0.001} shadow-radius={s.shadowRadius * 0.6} />
      </>)}

      {/* Post-processing — skipped when path tracer is actively rendering */}
      {effectsReady && !skipEffects && (
        <EffectComposer multisampling={0}>
          <N8AO
            aoRadius={s.aoRadius}
            intensity={s.ssao ? s.aoIntensity : 0}
            aoSamples={Math.min(s.aoSamples, 16)}
            denoiseSamples={4}
            quality={lowPerf ? "performance" : "medium"}
            screenSpaceRadius={false}
            halfRes={lowPerf}
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
          {((s.aaMode ?? "smaa") !== "none" ? <SMAA /> : null) as any}
        </EffectComposer>
      )}

    </>
  );
}
