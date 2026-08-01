import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:3001',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'Tablet',
      use: {
        ...devices['iPad Pro 11'], // Annäherung für Tablet-Auflösung
        viewport: { width: 1024, height: 1366 }, // Verbindliche Auflösung laut Korrekturdatei
      },
    },
  ],
  webServer: {
    command: 'npm run dev -- --hostname 127.0.0.1 --port 3001',
    url: 'http://localhost:3001',
    reuseExistingServer: !process.env.CI,
    env: {
      NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'http://127.0.0.1:1',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? 'playwright-anon-key',
      APP_SESSION_SECRET: process.env.APP_SESSION_SECRET ?? 'playwright-session-secret',
      DATABASE_URL: process.env.DATABASE_URL ?? 'postgres://user:pass@127.0.0.1:1/test',
    },
  },
});
