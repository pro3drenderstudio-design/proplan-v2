"use client";

import { useEffect, useRef } from "react";

export interface AdminSketchfabApi {
  getNodeMap: (
    cb: (err: unknown, nodeMap: Record<string, { name?: string; instanceID: number }>) => void
  ) => void;
  getCameraLookAt: (
    cb: (err: unknown, camera: { position: number[]; target: number[] }) => void
  ) => void;
  getFov: (cb: (err: unknown, fov: number) => void) => void;
  show: (instanceId: number) => void;
  hide: (instanceId: number) => void;
}

interface AdminSketchfabViewerProps {
  modelId: string;
  onApiReady: (api: AdminSketchfabApi) => void;
}

const SKETCHFAB_SCRIPT_URL = "https://static.sketchfab.com/api/sketchfab-viewer-1.12.1.js";

declare global {
  interface Window {
    Sketchfab: new (iframe: HTMLIFrameElement) => {
      init: (modelId: string, options: Record<string, unknown>) => void;
    };
  }
}

export default function AdminSketchfabViewer({ modelId, onApiReady }: AdminSketchfabViewerProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    if (!iframeRef.current) return;

    type FullInstance = AdminSketchfabApi & {
      addEventListener: (event: string, cb: () => void) => void;
    };

    function initViewer() {
      if (!window.Sketchfab || !iframeRef.current) return;
      const client = new window.Sketchfab(iframeRef.current);
      client.init(modelId, {
        success: (instance: FullInstance) => {
          instance.addEventListener("viewerready", () => {
            onApiReady(instance);
          });
        },
        error: () => console.error("AdminSketchfabViewer: init failed"),
        autostart: 1,
        ui_stop: 0,
        ui_infos: 0,
        ui_watermark: 0,
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

  return (
    <iframe
      ref={iframeRef}
      title="Node Bridge 3D Viewer"
      className="w-full h-full border-0"
      allow="autoplay; fullscreen; xr-spatial-tracking"
      allowFullScreen
    />
  );
}
