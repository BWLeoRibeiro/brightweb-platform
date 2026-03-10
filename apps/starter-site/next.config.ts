import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@brightweb/core-auth", "@brightweb/infra", "@brightweb/module-crm"],
};

export default nextConfig;
