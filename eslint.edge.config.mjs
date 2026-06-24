import { defineConfig } from "eslint/config";
import tseslint from "typescript-eslint";

/**
 * QG-01 Edge scope — Deno + TypeScript
 *
 * Applies to: supabase/functions/**\/*.ts
 * Run via:    npm run lint:edge   (eslint --config eslint.edge.config.mjs supabase/functions/)
 *
 * NO React, NO Next.js, NO Node-specific globals.
 * globals@14 does not ship a "deno" preset; Deno Web Platform globals are defined below.
 *
 * App scope   → eslint.config.mjs      (Next.js/React/TS)
 * Node scope  → eslint.scripts.config.mjs (Node CJS/ESM)
 */

/**
 * Deno Web Platform globals — what Supabase Edge Functions have at runtime.
 * Source: https://deno.land/api (stable APIs available in Supabase Edge Runtime)
 */
const denoGlobals = {
  // Deno namespace — the entry point for all Deno-specific APIs
  Deno: "readonly",
  // Web Platform APIs implemented by Deno (no window, no document)
  fetch: "readonly",
  Request: "readonly",
  Response: "readonly",
  Headers: "readonly",
  URL: "readonly",
  URLSearchParams: "readonly",
  FormData: "readonly",
  Blob: "readonly",
  File: "readonly",
  TextDecoder: "readonly",
  TextEncoder: "readonly",
  ReadableStream: "readonly",
  WritableStream: "readonly",
  TransformStream: "readonly",
  ReadableStreamDefaultReader: "readonly",
  crypto: "readonly",
  CryptoKey: "readonly",
  SubtleCrypto: "readonly",
  Event: "readonly",
  EventTarget: "readonly",
  CustomEvent: "readonly",
  AbortController: "readonly",
  AbortSignal: "readonly",
  WebSocket: "readonly",
  MessageEvent: "readonly",
  console: "readonly",
  setTimeout: "readonly",
  clearTimeout: "readonly",
  setInterval: "readonly",
  clearInterval: "readonly",
  queueMicrotask: "readonly",
  performance: "readonly",
  structuredClone: "readonly",
  atob: "readonly",
  btoa: "readonly",
  self: "readonly",
  globalThis: "readonly",
  // Deno supports these Web APIs too
  navigator: "readonly",
  location: "readonly",
};

export default defineConfig([
  {
    files: ["supabase/functions/**/*.ts"],
    languageOptions: {
      globals: denoGlobals,
      parser: tseslint.parser,
      parserOptions: {
        sourceType: "module",
      },
    },
    plugins: {
      "@typescript-eslint": tseslint.plugin,
    },
    rules: {
      // TypeScript rules — no React/Next.js rules applied
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      // Deno uses ESM; CommonJS require() is invalid
      "@typescript-eslint/no-require-imports": "error",
    },
  },
]);
