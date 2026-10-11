import { defineConfig, devices } from '@playwright/test';

// The app runs in DDEV, Playwright on the Mac. Phase 10 points it at the Compose stack via OPENBILL_URL.
const baseURL = process.env.OPENBILL_URL ?? 'https://openbill.ddev.site';

export default defineConfig({
    testDir: './tests',
    outputDir: './test-results',
    // one shared database (demo data): files run one after another
    fullyParallel: false,
    workers: 1,
    retries: 0,
    reporter: [['list']],
    globalSetup: './global-setup.ts',
    use: {
        baseURL,
        ignoreHTTPSErrors: true,
        locale: 'en-GB',
        timezoneId: 'Europe/Berlin',
        trace: 'retain-on-failure',
    },
    projects: [
        { name: 'chromium', testIgnore: /screenshots\.spec\.ts/, use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } },
        // review screenshots against the clickdummy (pnpm screenshots): only when asked for
        ...(process.env.SCREENSHOTS ? [{ name: 'screenshots', testMatch: /screenshots\.spec\.ts/, use: { ...devices['Desktop Chrome'] } }] : []),
    ],
});
