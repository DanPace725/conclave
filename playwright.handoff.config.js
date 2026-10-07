import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './packages/conclave-mcp/test/browser', outputDir: './.conclave/ui-test-results',
  fullyParallel: true, timeout: 30000,
  use: { baseURL: 'http://127.0.0.1:3214', launchOptions: { channel: 'msedge' } },
  projects: [
    { name: 'desktop', use: { viewport: { width: 1100, height: 900 } } },
    { name: 'mobile', use: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } },
  ],
  webServer: { command: 'node packages/conclave-mcp/src/ui-preview.js', url: 'http://127.0.0.1:3214', reuseExistingServer: false },
});
