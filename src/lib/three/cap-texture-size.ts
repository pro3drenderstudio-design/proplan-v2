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
  const ctx = canvas.getContext("2d");
  if (!ctx) return; // can't get 2D context — leave texture unchanged
  try {
    ctx.drawImage(img as CanvasImageSource, 0, 0, canvas.width, canvas.height);
  } catch {
    // Cross-origin image tainted the canvas — leave texture unchanged
    return;
  }
  texture.image = canvas;
  texture.needsUpdate = true;
}

let _textureLoaderPatched = false;

/**
 * Monkey-patches THREE.TextureLoader.prototype.load so every texture loaded
 * anywhere in the app (polyhaven, material library, GLB extras) is capped at
 * maxPx. Call once at app startup, before any scene is created.
 */
export function patchTextureLoader(maxPx = 1024): void {
  if (_textureLoaderPatched || typeof window === "undefined") return;
  _textureLoaderPatched = true;

  const origLoad = THREE.TextureLoader.prototype.load;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (THREE.TextureLoader.prototype as any).load = function(
    url: string,
    onLoad?: (t: THREE.Texture) => void,
    onProgress?: (e: ProgressEvent) => void,
    onError?: (e: unknown) => void,
  ): THREE.Texture {
    const wrapped = (texture: THREE.Texture) => {
      capTextureSize(texture, maxPx);
      onLoad?.(texture);
    };
    return origLoad.call(this, url, wrapped, onProgress, onError);
  };
}
