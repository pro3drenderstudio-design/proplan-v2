import * as THREE from "three";

/**
 * Downsamples a loaded texture in-place so neither dimension exceeds maxPx.
 * Uses an offscreen canvas — no network round-trip, works for any image format.
 * Call this immediately after TextureLoader.load resolves, before assigning
 * the texture to a material slot.
 */
export function capTextureSize(texture: THREE.Texture, maxPx = 1024): void {
  const img = texture.image as HTMLImageElement | HTMLCanvasElement | null;
  if (!img) return;
  const w = (img as HTMLImageElement).naturalWidth  || (img as HTMLCanvasElement).width  || 0;
  const h = (img as HTMLImageElement).naturalHeight || (img as HTMLCanvasElement).height || 0;
  if (!w || !h || (w <= maxPx && h <= maxPx)) return;
  const scale  = maxPx / Math.max(w, h);
  const canvas = document.createElement("canvas");
  canvas.width  = Math.round(w * scale);
  canvas.height = Math.round(h * scale);
  canvas.getContext("2d")?.drawImage(img as CanvasImageSource, 0, 0, canvas.width, canvas.height);
  texture.image = canvas;
  texture.needsUpdate = true;
}
