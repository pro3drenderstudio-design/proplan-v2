import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: false,
  serverExternalPackages: [
    "sharp",
    "draco3d",
    "@gltf-transform/core",
    "@gltf-transform/extensions",
    "@gltf-transform/functions",
    "@aws-sdk/client-s3",
    "@aws-sdk/s3-request-presigner",
  ],
};

export default nextConfig;
