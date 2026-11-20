import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // PDF.js resolves its existing Node reader worker relative to pdf.mjs.
  // Bundling it into a Next chunk moves that base and loses the worker file.
  serverExternalPackages: ["pdfjs-dist"],
  outputFileTracingIncludes: {
    "/*": ["./node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs", "./public/pdf/invoice/**/*"],
  },
  /* config options here */
};

export default nextConfig;
