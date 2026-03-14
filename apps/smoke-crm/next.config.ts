import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: [
    "@brightweblabs/app-shell",
    "@brightweblabs/core-auth",
    "@brightweblabs/infra",
    "@brightweblabs/ui",
    "@brightweblabs/module-crm",
  ],
};

export default nextConfig;
