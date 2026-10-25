import { defineConfig } from '@playwright/test';
import base from './playwright.config';

/** Keep the full desktop engines suite opt-in and its artifacts separate. */
export default defineConfig({
  ...base,
  timeout: 60_000,
  outputDir: process.env.BROWSER_OUTPUT_DIR ?? '.cache/browser-cross-results',
  reporter: [['list'], ['json', { outputFile: process.env.BROWSER_REPORT_FILE ?? '.cache/browser-cross-results.json' }]],
  use: { ...base.use, baseURL: process.env.RELEASE_BASE_URL ?? 'http://127.0.0.1:5198' },
  webServer: process.env.RELEASE_BASE_URL ? undefined : {
    command: 'npm run preview -- --host 127.0.0.1 --port 5198 --strictPort',
    url: 'http://127.0.0.1:5198', reuseExistingServer: !process.env.CI, timeout: 60_000,
  },
  projects: [
    { name: 'chromium', use: { browserName: 'chromium' } },
    { name: 'firefox', use: { browserName: 'firefox' } },
    { name: 'webkit', use: { browserName: 'webkit' } },
  ],
});
