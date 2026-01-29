import { defineConfig, devices } from '@playwright/test';

/**
 * Standalone Playwright configuration that uses existing running servers
 */
export default defineConfig({
  testDir: '.',
  fullyParallel: false,
  forbidOnly: false,
  retries: 0,
  workers: 1,
  reporter: 'list',

  use: {
    baseURL: 'http://localhost:3001',
    trace: 'on',
    screenshot: 'on',
    video: 'on',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  // No webServer - use existing running servers
});
