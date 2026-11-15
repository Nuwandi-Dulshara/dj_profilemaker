import { defineConfig } from '@playwright/test';

const port = process.env.E2E_PORT || '5173';
const origin = `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  workers: 1,
  timeout: 60000,
  use: { baseURL: origin, browserName: 'chromium', trace: 'retain-on-failure' },
  webServer: [
    { command: `node node_modules/vite/bin/vite.js --host 127.0.0.1 --port ${port} --strictPort`, url: origin, env: { STUDIO_API_TARGET: 'http://127.0.0.1:18000' }, reuseExistingServer: false },
    { command: 'node scripts/e2e.mjs serve', url: 'http://127.0.0.1:18000/api/auth/config/', reuseExistingServer: false },
  ],
});
