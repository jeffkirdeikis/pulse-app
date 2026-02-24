import { defineConfig, devices } from '@playwright/test';
import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load .env.local from parent
const envPath = resolve(__dirname, '..', '.env.local');
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 1).trim();
    if (!process.env[key]) process.env[key] = val;
  }
}

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 1,
  workers: process.env.CI ? 1 : 3,
  reporter: [
    ['html', { outputFolder: './reports/html-report' }],
    ['json', { outputFile: './reports/test-results.json' }],
  ],
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'on',
    video: 'retain-on-failure',
    actionTimeout: 10000,
    navigationTimeout: 15000,
  },
  projects: [
    {
      name: 'desktop-chrome',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'mobile-iphone',
      use: {
        ...devices['iPhone 14'],
      },
      testMatch: '**/11-cross-cutting.spec.js',
    },
    {
      name: 'tablet-ipad',
      use: {
        ...devices['iPad (gen 7)'],
      },
      testMatch: '**/11-cross-cutting.spec.js',
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: true,
    cwd: resolve(__dirname, '..'),
  },
  outputDir: './screenshots',
});
