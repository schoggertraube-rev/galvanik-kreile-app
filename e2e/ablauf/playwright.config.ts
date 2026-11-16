import {defineConfig} from '@playwright/test';

if(process.env.KREILE_S14A_DOM!=='1'||process.env.KREILE_OFFLINE_SMOKE!=='1')throw Error('S14A_EXPLICIT_TEST_REQUIRED');
export default defineConfig({
 testDir:'.',testMatch:'hauptansicht.dom.spec.ts',fullyParallel:false,
 forbidOnly:!!process.env.CI,retries:0,workers:1,reporter:'line',
 // DOM/screenshot diagnostics only: a trace would persist signed TEST cookies.
 use:{browserName:'chromium',baseURL:'http://localhost:3001',viewport:{width:1280,height:900},trace:'off',screenshot:'only-on-failure'},
 webServer:{
  cwd:process.cwd(),
  command:'node scripts/testing/offline-smoke-start.mjs',url:'http://localhost:3001/__TEST/ready',
  timeout:process.env.CI?180_000:60_000,reuseExistingServer:false,stdout:'pipe',
 },
});
