"use client";

import { useEffect, useRef, useState } from "react";
import { PhaseId } from "@/constants/phases";
import { SketchfabCameraApi } from "@/utils/sketchfab-camera";
import { applyVisibility, NodeMap, LevelId } from "@/logic/visibilityController";
import { ModelNodeGroups } from "@/types/database";

export type ViewerStatus = "loading" | "ready" | "error";

const SKETCHFAB_SCRIPT_URL = "https://static.sketchfab.com/api/sketchfab-viewer-1.12.1.js";

export interface SketchfabViewerProps {
  modelId: string;
  currentPhase: PhaseId;
  currentLevel: LevelId;
  selectedOptions?: string[];      // node names currently selected
  allOptionNodes?: string[];       // MASTER LIST of all configurable node names from DB
  nodeGroups?: ModelNodeGroups;    // per-model node name overrides
  onApiReady?: (api: SketchfabCameraApi) => void;
  onStatusChange?: (status: ViewerStatus) => void;
}

interface SketchfabInstance extends SketchfabCameraApi {
  getNodeMap: (cb: (err: unknown, nodeMap: NodeMap) => void) => void;
  show: (instanceId: number) => void;
  hide: (instanceId: number) => void;
  addEventListener: (event: string, cb: () => void) => void;
}

declare global {
  interface Window {
    Sketchfab: new (iframe: HTMLIFrameElement) => {
      init: (modelId: string, options: Record<string, unknown>) => void;
    };
  }
}

export default function SketchfabViewer({
  modelId,
  currentPhase,
  currentLevel,
  selectedOptions = [],
  allOptionNodes = [],
  nodeGroups,
  onApiReady,
  onStatusChange,
}: SketchfabViewerProps) {
  const iframeRef   = useRef<HTMLIFrameElement>(null);
  const apiRef      = useRef<SketchfabInstance | null>(null);
  const nodeMapRef  = useRef<NodeMap | null>(null);

  const [viewerStatus, setViewerStatus] = useState<ViewerStatus>("loading");
  const [isModelInitialized, setIsModelInitialized] = useState(false);

  function updateStatus(next: ViewerStatus) {
    setViewerStatus(next);
    onStatusChange?.(next);
  }

  useEffect(() => {
    if (!iframeRef.current) return;

    updateStatus("loading");
    setIsModelInitialized(false);
    apiRef.current = null;
    nodeMapRef.current = null;

    function initViewer() {
      if (!window.Sketchfab || !iframeRef.current) return;

      const isMobile = /Mobi|Android/i.test(navigator.userAgent);

      const client = new window.Sketchfab(iframeRef.current);
      client.init(modelId, {
        success: (instance: SketchfabInstance) => {
          apiRef.current = instance;

          instance.addEventListener("viewerready", () => {
            instance.getNodeMap((err, rawNodeMap) => {
              if (err) {
                console.error("SketchfabViewer: getNodeMap failed", err);
                updateStatus("error");
                return;
              }

              // Sketchfab returns nodes keyed by instanceID (numeric string),
              // e.g. { "0": { name: "Global_Roof_Group", instanceID: 0 }, ... }
              // Rebuild as name-keyed map so visibilityController can do nodeMap["Global_Roof_Group"].
              const nameKeyedMap: NodeMap = {};
              for (const id in rawNodeMap) {
                const node = rawNodeMap[id] as { name?: string; instanceID: number };
                if (node.name) nameKeyedMap[node.name] = node as NodeMap[string];
              }

              nodeMapRef.current = nameKeyedMap;
              updateStatus("ready");
              onApiReady?.(instance);
              setIsModelInitialized(true);
            });
          });
        },
        error: () => {
          console.error("SketchfabViewer: client.init failed");
          updateStatus("error");
        },
        autostart: 1,
        preload: 1,
        ui_stop: 0,
        ui_infos: 0,
        ui_watermark: 0,
        max_texture_size: isMobile ? 1024 : 2048,
      });
    }

    if (window.Sketchfab) {
      initViewer();
      return;
    }

    const script = document.createElement("script");
    script.src = SKETCHFAB_SCRIPT_URL;
    script.async = true;
    script.addEventListener("load", initViewer);
    document.body.appendChild(script);
    return () => script.removeEventListener("load", initViewer);
  }, [modelId]);

  // ── Effect 2: Visibility ───────────────────────────────────────────────────
  useEffect(() => {
    if (!isModelInitialized || !apiRef.current || !nodeMapRef.current) return;

    applyVisibility(
      apiRef.current,
      nodeMapRef.current,
      currentPhase,
      currentLevel,
      nodeGroups,
      selectedOptions,
      allOptionNodes,
    );
  }, [isModelInitialized, currentPhase, currentLevel, nodeGroups, selectedOptions, allOptionNodes]);

  return (
    <div className="relative w-full h-full bg-slate-950">
      {viewerStatus === "error" && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/70">
          <p className="text-sm text-red-400">Failed to load 3D model. Please refresh.</p>
        </div>
      )}

      <iframe
        ref={iframeRef}
        title="ProPlan Studio 3D Viewer"
        className="w-full h-full border-0 transition-opacity duration-500"
        style={{ opacity: viewerStatus === "ready" ? 1 : 0 }}
        allow="autoplay; fullscreen; xr-spatial-tracking"
        allowFullScreen
      />
    </div>
  );
}