import { defineConfig, devices } from '@playwright/test';
const offlineSmoke=process.env.KREILE_OFFLINE_SMOKE==='1';

export default defineConfig({
  testDir: './e2e',
  // These chains run with real Server Actions in the existing Replay acceptance job.
  testIgnore: ['**/ablauf/**'],
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: 'html',
  ...(offlineSmoke?{globalTeardown:'./e2e/offline-device-smoke.teardown.ts'}:{}),
  use: {
    baseURL: 'http://localhost:3001',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'Tablet',
      testIgnore:['**/ablauf/**','**/offline-device-smoke.real.spec.ts'],
      use: {
        ...devices['iPad Pro 11'], // Annäherung für Tablet-Auflösung
        viewport: { width: 1024, height: 1366 }, // Verbindliche Auflösung laut Korrekturdatei
      },
    },
    ...(offlineSmoke?(['chromium','webkit','firefox'] as const).flatMap(browserName=>[{name:'phone',width:360,height:800},{name:'tablet',width:1024,height:1366},{name:'desktop',width:1280,height:900}].map(size=>({name:`offline-${browserName}-${size.name}`,testMatch:'**/offline-device-smoke.real.spec.ts',use:{browserName,viewport:{width:size.width,height:size.height},baseURL:'http://localhost:3001'}}))):[]),
  ],
  webServer: {
    ...(offlineSmoke?{stdout:'pipe' as const}:{}),
    // PL 12.11.19:45: after the single failed infrastructure retry, CI only.
    timeout: process.env.CI ? 180_000 : 60_000,
    command: offlineSmoke?'node scripts/testing/offline-smoke-start.mjs':'npm run dev -- --hostname 127.0.0.1 --port 3001',
    url: offlineSmoke?'http://localhost:3001/__TEST/ready':'http://localhost:3001',
    reuseExistingServer: offlineSmoke?false:!process.env.CI,
    env: {
      NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'http://127.0.0.1:1',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? 'playwright-anon-key',
      APP_SESSION_SECRET: process.env.APP_SESSION_SECRET ?? 'playwright-session-secret',
      DATABASE_URL: process.env.DATABASE_URL ?? 'postgres://user:pass@127.0.0.1:1/test',
    },
  },
});
