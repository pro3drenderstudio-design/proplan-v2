import * as THREE from "three";

let patched = false;

/**
 * Polyhaven GLTF files reference textures as `textures/{filename}` relative to
 * the .gltf file, but the actual textures live at `/Models/jpg/2k/{id}/{filename}`.
 * This installs a one-time URL modifier on THREE.DefaultLoadingManager to rewrite
 * those texture requests to the correct CDN path.
 */
export function patchPolyhavenLoader() {
  if (patched) return;
  patched = true;
  THREE.DefaultLoadingManager.setURLModifier((url) => {
    // GLTF files reference textures at ./textures/{file} but actual CDN path is /Models/jpg/{res}/{id}/{file}
    const match = url.match(/\/Models\/gltf\/([^/]+)\/([^/]+)\/textures\/(.+)$/);
    if (match) {
      const [, res, id, filename] = match;
      return `https://dl.polyhaven.org/file/ph-assets/Models/jpg/${res}/${id}/${filename}`;
    }
    return url;
  });
}
