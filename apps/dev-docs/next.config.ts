import type { NextConfig } from "next";
import createMDX from "@next/mdx";

const withMDX = createMDX({
  options: {},
});

const nextConfig: NextConfig = {
  pageExtensions: ["ts", "tsx", "md", "mdx"],
  // Index pages read README files again during runtime regeneration.
  outputFileTracingIncludes: {
    "/docs/**": ["../../docs/README.md", "../../docs/{foundations,modules,recipes}/README.md"],
  },
};

export default withMDX(nextConfig);
