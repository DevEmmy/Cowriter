import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["pptxgenjs", "pdf-lib", "mammoth", "unpdf"],
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
