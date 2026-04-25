import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: false,
  serverExternalPackages: [
    "sharp",
    "@gltf-transform/core",
    "@gltf-transform/functions",
    "@gltf-transform/extensions",
    "draco3d",
  ],
};

export default nextConfig;
