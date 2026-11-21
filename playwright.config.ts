/// <reference lib="dom" />
import { defineConfig, devices, type Project } from '@playwright/test';

/**
 * Multi-user collaboration runs are deterministic only with a single worker:
 * every spec seeds its own users/board and shares one dev stack and one Redis room.
 *
 * Environment overrides:
 *   E2E_WEB_URL      web app under test          (default http://localhost:5173)
 *   E2E_API_URL      REST API + WS gateway       (default http://localhost:3000)
 *   E2E_CROSS_BROWSER=1  also run Firefox + WebKit projects
 *   PW_HEADED=1      show browser windows
 */
const webURL = process.env.E2E_WEB_URL ?? 'http://localhost:5173';
const apiURL = process.env.E2E_API_URL ?? process.env.VITE_API_URL ?? 'http://localhost:3000';

function device(name: string) {
  const preset = devices[name];
  if (!preset) throw new Error(`Unknown Playwright device preset: ${name}`);
  return preset;
}

const projects: Project[] = [
  {
    name: 'chromium',
    use: { ...device('Desktop Chrome'), baseURL: webURL },
  },
];

if (process.env.E2E_CROSS_BROWSER === '1') {
  projects.push(
    { name: 'firefox', use: { ...device('Desktop Firefox'), baseURL: webURL } },
    { name: 'webkit', use: { ...device('Desktop Safari'), baseURL: webURL } },
  );
}

export default defineConfig({
  testDir: './tests/e2e',
  outputDir: 'tests/e2e/test-results',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  globalTimeout: 15 * 60_000,
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 2 : 0,
  forbidOnly: Boolean(process.env.CI),
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'tests/e2e/playwright-report' }]],
  use: {
    baseURL: webURL,
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    headless: process.env.PW_HEADED !== '1',
    viewport: { width: 1440, height: 900 },
  },
  projects,
  webServer: {
    command: 'pnpm dev',
    url: webURL,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    env: {
      VITE_API_URL: apiURL,
      E2E_API_URL: apiURL,
    },
  },
});
