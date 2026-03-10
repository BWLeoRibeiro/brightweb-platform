import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: [
    "@brightweblabs/app-shell",
    "@brightweblabs/core-auth",
    "@brightweblabs/infra",
    "@brightweblabs/module-admin",
    "@brightweblabs/module-crm",
    "@brightweblabs/module-projects",
    "@brightweblabs/ui",
  ],
};

export default nextConfig;
