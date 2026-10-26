import { defineConfig } from '@playwright/test';
import crossBrowser from './playwright.cross-browser.config';

/** Explicit installed channels; never download or silently replace a browser. */
export default defineConfig({
  ...crossBrowser,
  outputDir: process.env.BROWSER_OUTPUT_DIR ?? '.cache/browser-installed-results',
  reporter: [['list'], ['json', { outputFile: process.env.BROWSER_REPORT_FILE ?? '.cache/browser-installed-results.json' }]],
  projects: [
    { name: 'chrome', use: { browserName: 'chromium', channel: 'chrome' } },
    { name: 'edge', use: { browserName: 'chromium', channel: 'msedge' } },
  ],
});
