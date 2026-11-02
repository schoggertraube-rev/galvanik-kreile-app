import { defineConfig } from "@playwright/test";

process.env.APP_SESSION_SECRET ??= "flow-tests-local-session-secret-2026-11-02";

export default defineConfig({
  testDir: ".",
  testMatch: "*.flow.spec.ts",
  fullyParallel: false,
  workers: 1,
  reporter: "line",
  use: {
    baseURL: "http://127.0.0.1:3001",
    viewport: { width: 1914, height: 917 },
    trace: "on-first-retry",
  },
  webServer: {
    command: "npm run start -- --hostname 127.0.0.1 --port 3001",
    url: "http://127.0.0.1:3001/start",
    timeout: 60_000,
    reuseExistingServer: !process.env.CI,
    env: {
      NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
      APP_SESSION_SECRET: process.env.APP_SESSION_SECRET ?? "flow-tests-local-session-secret-2026-11-02",
      DATABASE_URL: process.env.DATABASE_URL ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres",
      KREILE_TENANT_SLUG: process.env.KREILE_TENANT_SLUG ?? "galvanik-kreile",
    },
  },
});
