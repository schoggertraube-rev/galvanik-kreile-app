import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // The unchanged inline v10 sheet references this original asset relatively.
  // Serve the one source file from nested routes too, without CSS overrides.
  async rewrites() {
    return [{source:'/:prefix+/kreile-logo.png',destination:'/kreile-logo.png'}];
  },
  // PDF.js resolves its existing Node reader worker relative to pdf.mjs.
  // Bundling it into a Next chunk moves that base and loses the worker file.
  serverExternalPackages: ["pdfjs-dist"],
  outputFileTracingIncludes: {
    "/*": ["./node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs", "./public/pdf/invoice/**/*"],
  },
  /* config options here */
};

export default nextConfig;
