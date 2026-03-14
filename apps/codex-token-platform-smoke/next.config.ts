import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: [
    "@brightweblabs/app-shell",
    "@brightweblabs/core-auth",
    "@brightweblabs/infra",
    "@brightweblabs/ui",
  ],
};

export default nextConfig;
