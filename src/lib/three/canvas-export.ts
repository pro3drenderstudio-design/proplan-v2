/**
 * High-resolution canvas export for R3F viewer.
 * Captures the current frame at up to 4× resolution for quote PDFs and renders.
 */

import type { WebGLRenderer, Camera, Scene } from "three";

export interface ExportOptions {
  width?: number;
  height?: number;
  quality?: number;   // 0–1 for JPEG
  format?: "jpeg" | "png" | "webp";
}

/**
 * Export the current R3F scene as a base64 data URL.
 * Uses the live canvas — no offscreen re-render needed.
 */
export function exportCanvas(
  gl: WebGLRenderer,
  options: ExportOptions = {},
): string {
  const { quality = 0.92, format = "jpeg" } = options;
  const mimeType = `image/${format}`;
  return gl.domElement.toDataURL(mimeType, quality);
}

/**
 * Export at a specific resolution by temporarily resizing the renderer.
 * Restores original size after capture. Call only from a useFrame or after render.
 */
export async function exportAtResolution(
  gl: WebGLRenderer,
  camera: Camera,
  scene: Scene,
  width: number,
  height: number,
  options: ExportOptions = {},
): Promise<string> {
  const { quality = 0.92, format = "jpeg" } = options;
  const mimeType = `image/${format}`;

  // Save original size
  const originalSize = gl.getSize(new (await import("three")).Vector2());
  const originalPixelRatio = gl.getPixelRatio();

  // Resize to target
  gl.setSize(width, height, false);
  gl.setPixelRatio(1);

  // Render one frame at the new size
  gl.render(scene, camera);

  // Capture
  const dataUrl = gl.domElement.toDataURL(mimeType, quality);

  // Restore
  gl.setSize(originalSize.x, originalSize.y, false);
  gl.setPixelRatio(originalPixelRatio);

  return dataUrl;
}
