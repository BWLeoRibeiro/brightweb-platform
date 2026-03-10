import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: [
    "@brightweb/app-shell",
    "@brightweb/core-auth",
    "@brightweb/infra",
    "@brightweb/module-admin",
    "@brightweb/module-crm",
    "@brightweb/module-projects",
    "@brightweb/ui",
  ],
};

export default nextConfig;
