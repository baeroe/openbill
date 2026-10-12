import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { test, type Page } from '@playwright/test';
import { login } from './helpers';

/**
 * Review screenshots, not a regression test: every page at 1440 and 390 px in light and dark, from the app and –
 * with CLICKDUMMY_URL – from prototypes/clickdummy-v2 for the side-by-side comparison.
 * Output: e2e/screenshots/{app,clickdummy}/<page>-<width>-<theme>.png (git-ignored). Run: pnpm --dir e2e screenshots
 */
const VIEWPORTS = [
    { width: 1440, height: 900 },
    { width: 390, height: 844 },
];
const THEMES = ['light', 'dark'] as const;
const OUT = path.resolve(import.meta.dirname, '../screenshots');

/** `prefix` is "/en" for the app (language prefix) and "" for the clickdummy. */
type Shot = { name: string; open(page: Page, prefix: string): Promise<void> };

const go = async (page: Page, prefix: string, to: string): Promise<void> => {
    await page.goto(to === '/' ? prefix || '/' : `${prefix}${to}`);
};

const SHOTS: Shot[] = [
    { name: 'overview', open: (page, prefix) => go(page, prefix, '/') },
    { name: 'documents', open: (page, prefix) => go(page, prefix, '/documents') },
    {
        name: 'new-document',
        open: async (page, prefix) => {
            await go(page, prefix, '/documents');
            await page.keyboard.press('n');
            await page.getByRole('dialog').waitFor();
        },
    },
    { name: 'customers', open: (page, prefix) => go(page, prefix, '/customers') },
    {
        name: 'customer',
        open: async (page, prefix) => {
            await go(page, prefix, '/customers');
            await page.getByRole('link', { name: /Hafenkontor Lindqvist GmbH/ }).first().click();
            // the list shows the contact as well: wait for the detail form itself
            await page.waitForURL(/\/customers\/[^/]+$/);
            await page.locator('input[value="Hafenkontor Lindqvist GmbH"]').waitFor();
        },
    },
    {
        name: 'editor',
        open: async (page, prefix) => {
            await go(page, prefix, '/documents');
            await page.getByRole('link', { name: /Hafenkontor Lindqvist GmbH/ }).first().click();
            await page.waitForURL(/\/documents\/[^/?]+$/);
            // the preview is ready when the first page of paged-preview is laid out
            await page.locator('.pp-page').first().waitFor();
        },
    },
];

async function capture(page: Page, dir: string, name: string): Promise<void> {
    await page.waitForLoadState('networkidle');
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: path.join(dir, `${name}.png`), fullPage: true });
}

for (const viewport of VIEWPORTS) {
    for (const theme of THEMES) {
        test.describe(`${viewport.width} ${theme}`, () => {
            test.use({ viewport });

            test('app', async ({ page }) => {
                const dir = path.join(OUT, 'app');
                mkdirSync(dir, { recursive: true });
                await page.addInitScript((value) => window.localStorage.setItem('openbill:theme', value), theme);

                await page.goto('/en/login');
                await capture(page, dir, `login-${viewport.width}-${theme}`);
                await login(page);
                for (const shot of SHOTS) {
                    await shot.open(page, '/en');
                    await capture(page, dir, `${shot.name}-${viewport.width}-${theme}`);
                }
            });

            test('clickdummy', async ({ browser }) => {
                const base = process.env.CLICKDUMMY_URL;
                test.skip(!base, 'CLICKDUMMY_URL is not set');
                const dir = path.join(OUT, 'clickdummy');
                mkdirSync(dir, { recursive: true });
                const ui = (signedIn: boolean) => JSON.stringify({ state: { theme, signedIn, sidebarCollapsed: false, previewOpen: true, showGuides: false }, version: 0 });

                const guest = await browser.newPage({ viewport, baseURL: base });
                await guest.addInitScript((value) => window.localStorage.setItem('openbill:ui', value), ui(false));
                await guest.goto('/login');
                await capture(guest, dir, `login-${viewport.width}-${theme}`);
                await guest.close();

                const page = await browser.newPage({ viewport, baseURL: base });
                await page.addInitScript((value) => window.localStorage.setItem('openbill:ui', value), ui(true));
                for (const shot of SHOTS) {
                    await shot.open(page, '');
                    await capture(page, dir, `${shot.name}-${viewport.width}-${theme}`);
                }
                await page.close();
            });
        });
    }
}
