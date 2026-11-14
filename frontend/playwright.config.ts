import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  workers: 1,
  timeout: 60000,
  use: { baseURL: 'http://127.0.0.1:5173', browserName: 'chromium', trace: 'retain-on-failure' },
  webServer: [
    { command: 'node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 5173 --strictPort', url: 'http://127.0.0.1:5173', env: { STUDIO_API_TARGET: 'http://127.0.0.1:18000' }, reuseExistingServer: false },
    { command: 'node scripts/e2e.mjs serve', url: 'http://127.0.0.1:18000/api/auth/config/', reuseExistingServer: false },
  ],
});
