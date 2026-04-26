import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: false,
  serverExternalPackages: [
    "sharp",
    "draco3d",
    "@gltf-transform/core",
    "@gltf-transform/extensions",
    "@gltf-transform/functions",
  ],
};

export default nextConfig;
