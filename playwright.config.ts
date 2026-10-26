import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/browser',
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  use: { baseURL:process.env.RELEASE_BASE_URL??'http://127.0.0.1:5195',viewport:{width:1440,height:900},trace:'retain-on-failure' },
  webServer:process.env.RELEASE_BASE_URL?undefined:{ command:'npm run preview -- --host 127.0.0.1 --port 5195 --strictPort',url:'http://127.0.0.1:5195',reuseExistingServer:!process.env.CI,timeout:60000 },
  projects:[{name:'chromium',use:{browserName:'chromium'}}],
});
