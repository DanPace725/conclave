import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './packages/conclave-hosted/test/browser', outputDir: './.conclave/dashboard-test-results',
  fullyParallel: true, timeout: 30000,
  use: { baseURL: 'http://127.0.0.1:3226', launchOptions: { channel: 'msedge' } },
  projects: [
    { name: 'desktop', use: { viewport: { width: 1440, height: 1000 } } },
    { name: 'mobile', use: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } },
  ],
  webServer: { command: 'node packages/conclave-hosted/src/dashboard-preview.js', url: 'http://127.0.0.1:3226/dashboard', reuseExistingServer: false },
});
