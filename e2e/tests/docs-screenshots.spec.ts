import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { apiDelete, apiGet } from './helpers';

/**
 * Screenshots of the documentation, committed under docs/public/screenshots/{en,de}/<name>.png: the demo data of
 * DemoSeeder (global-setup seeds it before the run), 1440×900, light; shots with `dark` also as <name>-dark.png.
 * English pages show the English UI, German pages the German one. Run: pnpm --dir e2e docs:screenshots – then look at
 * every image before committing. Fictional data only (DemoSeeder, E2eUserSeeder).
 */
const OUT = path.resolve(import.meta.dirname, '../../docs/public/screenshots');
const LOCALES = ['en', 'de'] as const;
type Locale = (typeof LOCALES)[number];
type Theme = 'light' | 'dark';
type Shot = { name: string; dark?: boolean; open(page: Page, locale: Locale): Promise<void> };

/** The browser language of each project (playwright.config.ts: docs-screenshots-en/-de, date inputs follow --lang). */
const BROWSER_LOCALE: Record<Locale, string> = { en: 'en-GB', de: 'de-DE' };

const go = (page: Page, locale: Locale, to: string) => page.goto(to === '/' ? `/${locale}` : `/${locale}${to}`);

/** The draft invoice of Hafenkontor Lindqvist: groups, custom fields, live preview. */
async function openEditor(page: Page, locale: Locale): Promise<void> {
    await go(page, locale, '/documents');
    await page.getByRole('link', { name: /Hafenkontor Lindqvist GmbH/ }).first().click();
    await page.waitForURL(/\/documents\/[^/?]+$/);
    await page.locator('.pp-page').first().waitFor();
}

const SHOTS: Shot[] = [
    { name: 'overview', open: (page, locale) => go(page, locale, '/') },
    { name: 'documents', open: (page, locale) => go(page, locale, '/documents') },
    { name: 'editor', dark: true, open: openEditor },
    {
        name: 'customer',
        open: async (page, locale) => {
            await go(page, locale, '/customers');
            await page.getByRole('link', { name: /Hafenkontor Lindqvist GmbH/ }).first().click();
            await page.waitForURL(/\/customers\/[^/]+$/);
            await page.locator('input[value="Hafenkontor Lindqvist GmbH"]').waitFor();
        },
    },
    { name: 'templates', open: (page, locale) => go(page, locale, '/templates') },
    {
        name: 'template-editor',
        open: async (page, locale) => {
            await go(page, locale, '/templates');
            await page.getByRole('link', { name: locale === 'de' ? 'Klar ansehen' : 'View Klar' }).first().click();
            await page.waitForURL(/\/templates\/[^/]+$/);
            await page.locator('.pp-page').first().waitFor();
        },
    },
    { name: 'fields', open: (page, locale) => go(page, locale, '/fields?scope=document') },
    { name: 'settings-organization', open: (page, locale) => go(page, locale, '/settings/organization') },
    { name: 'settings-api', open: (page, locale) => go(page, locale, '/settings/api') },
    {
        // a finalized EN 16931 invoice (Fjord Analytics, reverse charge) with its archived XML
        name: 'einvoice',
        open: async (page, locale) => {
            await go(page, locale, '/documents?q=0040');
            await page.getByRole('link', { name: /RE-\d{4}-0040/ }).first().click();
            await page.waitForURL(/\/documents\/[^/?]+$/);
            await page.getByRole('tab', { name: locale === 'de' ? 'E-Rechnung' : 'E-invoice' }).click();
            await page.getByText(/CrossIndustryInvoice/).first().waitFor();
        },
    },
];

async function capture(page: Page, file: string): Promise<void> {
    await page.waitForLoadState('networkidle');
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: file, animations: 'disabled', caret: 'hide' });
}

const fileOf = (locale: Locale, name: string, theme: Theme) => path.join(OUT, locale, theme === 'light' ? `${name}.png` : `${name}-dark.png`);

for (const locale of LOCALES) {
    // project docs-screenshots-<locale> runs the group docs-<locale> (grep in playwright.config.ts)
    test.describe(`docs-${locale}`, () => {
        test.beforeAll(() => mkdirSync(path.join(OUT, locale), { recursive: true }));

        test('login', async ({ browser, baseURL }) => {
            // signed out: a context without the stored session (newContext would take the project's storageState)
            const context = await browser.newContext({
                baseURL,
                viewport: { width: 1440, height: 900 },
                deviceScaleFactor: 1,
                ignoreHTTPSErrors: true,
                colorScheme: 'light',
                locale: BROWSER_LOCALE[locale],
                storageState: { cookies: [], origins: [] },
            });
            const page = await context.newPage();
            await page.addInitScript(() => window.localStorage.setItem('openbill:theme', 'light'));
            await page.goto(`/${locale}/login`);
            await capture(page, fileOf(locale, 'login', 'light'));
            await context.close();
        });

        for (const shot of SHOTS) {
            test(shot.name, async ({ page }) => {
                for (const theme of (shot.dark ? ['light', 'dark'] : ['light']) as Theme[]) {
                    await page.emulateMedia({ colorScheme: theme });
                    // init scripts add up: the last one sets the theme before the next page load
                    await page.addInitScript((value) => window.localStorage.setItem('openbill:theme', value), theme);
                    await shot.open(page, locale);
                    await capture(page, fileOf(locale, shot.name, theme));
                }
            });
        }

        test('toolkit', async ({ page }) => {
            await page.addInitScript(() => window.localStorage.setItem('openbill:theme', 'light'));
            await go(page, locale, '/templates');
            const templates = (await apiGet(page, '/api/templates')) as { id: string; slug: string }[];
            const klar = templates.find((template) => template.slug === 'klar')!;
            // built-in templates have no toolkit: a copy, removed again afterwards; named in the page's language
            // ("Klar (Kopie)") like the UI's duplicate button does it
            const xsrf = (await page.context().cookies()).find((cookie) => cookie.name === 'XSRF-TOKEN')?.value ?? '';
            const response = await page.request.post(`/api/templates/${klar.id}/duplicate`, {
                data: {},
                headers: { Accept: 'application/json', 'Accept-Language': locale, Referer: page.url(), 'X-XSRF-TOKEN': decodeURIComponent(xsrf) },
            });
            expect(response.ok(), await response.text()).toBe(true);
            const copy = (await response.json()) as { id: string };
            try {
                await go(page, locale, `/templates/${copy.id}`);
                await page.locator('.pp-page').first().waitFor();
                await page.getByRole('button', { name: 'Toolkit', exact: true }).click();
                await expect(page.getByRole('dialog')).toContainText('pnpm run pack');
                await capture(page, fileOf(locale, 'toolkit', 'light'));
            } finally {
                await apiDelete(page, `/api/templates/${copy.id}`);
            }
        });
    });
}
