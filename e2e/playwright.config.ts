import { defineConfig, devices } from '@playwright/test';
import { AUTH_FILE } from './tests/helpers';

// The app runs in DDEV, Playwright on the Mac. OPENBILL_URL points it at another instance, e.g. the Compose stack
// (http://localhost:7739 with E2E_ARTISAN, see e2e/compose.sh and the CI job e2e).
// Screenshots for the docs (docs/public/screenshots, committed): pnpm --dir e2e docs:screenshots
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
        // signs in once and stores the session (login is throttled: 20 attempts a minute per IP)
        { name: 'setup', testMatch: /auth\.setup\.ts/ },
        {
            name: 'chromium',
            testIgnore: /screenshots\.spec\.ts/,
            dependencies: ['setup'],
            use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 }, storageState: AUTH_FILE },
        },
        // review screenshots against the clickdummy (pnpm screenshots): only when asked for
        ...(process.env.SCREENSHOTS ? [{ name: 'screenshots', testMatch: /\/screenshots\.spec\.ts$/, use: { ...devices['Desktop Chrome'] } }] : []),
        // screenshots for the docs (pnpm docs:screenshots): signed in like the suite, 1440×900, device scale 1; one
        // project per language because date inputs follow the browser's UI language (--lang), not the context locale
        ...(process.env.DOCS_SCREENSHOTS
            ? (['en', 'de'] as const).map((language) => {
                  const locale = language === 'de' ? 'de-DE' : 'en-GB';
                  return {
                      name: `docs-screenshots-${language}`,
                      testMatch: /docs-screenshots\.spec\.ts$/,
                      grep: new RegExp(`docs-${language} `),
                      dependencies: ['setup'],
                      use: {
                          ...devices['Desktop Chrome'],
                          viewport: { width: 1440, height: 900 },
                          deviceScaleFactor: 1,
                          storageState: AUTH_FILE,
                          locale,
                          launchOptions: { args: [`--lang=${locale}`] },
                      },
                  };
              })
            : []),
    ],
});
