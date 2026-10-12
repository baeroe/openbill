import { execFileSync, spawn, type ChildProcess } from 'node:child_process';
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { expect, test } from '@playwright/test';
import { apiDelete, apiGet, apiPost } from './helpers';

const PORT = 5190;
const KIT_URL = `http://localhost:${PORT}`;
const SCREENSHOTS = path.resolve(import.meta.dirname, '../screenshots');
// Node on the Mac must trust the DDEV certificate (mkcert CA in the keychain), like a template author would
const nodeEnv = { ...process.env, NODE_OPTIONS: [process.env.NODE_OPTIONS, '--use-system-ca'].filter(Boolean).join(' ') };

async function waitForKit(timeout: number): Promise<void> {
    const until = Date.now() + timeout;
    while (Date.now() < until) {
        try {
            if ((await fetch(`${KIT_URL}/__openbill/state`)).ok) return;
        } catch {
            // dev server not up yet
        }
        await new Promise((resolve) => setTimeout(resolve, 500));
    }
    throw new Error(`pnpm dev did not answer on ${KIT_URL} within ${timeout} ms`);
}

test('toolkit: download, pnpm install && pnpm dev, live preview without reload, push and pack (spec 1)', async ({ page }) => {
    test.setTimeout(360_000);
    await page.goto('/en/templates');
    const templates = (await apiGet(page, '/api/templates')) as { id: string; slug: string }[];
    const klar = templates.find((template) => template.slug === 'klar')!;
    const copy = (await apiPost(page, `/api/templates/${klar.id}/duplicate`)) as { id: string; slug: string };
    // outside the repository: e2e/ is a pnpm workspace of its own
    const work = mkdtempSync(path.join(tmpdir(), 'openbill-toolkit-'));
    let dev: ChildProcess | undefined;

    try {
        // 1. dialog and download
        await page.goto(`/en/templates/${copy.id}`);
        await page.getByRole('button', { name: 'Toolkit', exact: true }).click();
        const dialog = page.getByRole('dialog', { name: 'Template toolkit' });
        await expect(dialog).toContainText('.env.local');
        await expect(dialog).toContainText('pnpm run pack');
        mkdirSync(SCREENSHOTS, { recursive: true });
        await page.screenshot({ path: path.join(SCREENSHOTS, 'toolkit-dialog-1440.png'), animations: 'disabled' });
        const downloading = page.waitForEvent('download');
        await dialog.getByRole('button', { name: 'Download toolkit' }).click();
        const download = await downloading;
        expect(download.suggestedFilename()).toBe(`openbill-toolkit-${copy.slug}.zip`);
        const zip = path.join(work, download.suggestedFilename());
        await download.saveAs(zip);
        await expect(page.getByText('Toolkit downloaded')).toBeVisible();

        // 2. unpack, install, start
        execFileSync('unzip', ['-q', zip, '-d', work]);
        const kit = path.join(work, `openbill-${copy.slug}`);
        expect(readFileSync(path.join(kit, '.env.local'), 'utf8')).toContain(`OPENBILL_TEMPLATE_ID="${copy.id}"`);
        expect(readFileSync(path.join(kit, '.gitignore'), 'utf8')).toContain('.env.local');
        execFileSync('pnpm', ['install'], { cwd: kit, env: nodeEnv, stdio: 'inherit', timeout: 180_000 });
        dev = spawn('pnpm', ['dev', '--port', String(PORT), '--strictPort'], { cwd: kit, env: nodeEnv, stdio: 'inherit', detached: true });
        await waitForKit(60_000);

        // 3. the preview page renders the template, several pages with the long sample invoice
        const kitPage = await page.context().newPage();
        await kitPage.setViewportSize({ width: 1440, height: 900 });
        await kitPage.goto(KIT_URL);
        await expect(kitPage.locator('.pp-page').first()).toBeVisible({ timeout: 30_000 });
        await kitPage.getByLabel('Data').selectOption('scenario:long_invoice');
        await expect(kitPage.getByText(/^\d+ pages$/)).toBeVisible({ timeout: 30_000 });
        await expect(kitPage.getByRole('complementary', { name: 'Fields' })).toContainText('document.number');

        // 4. change template.liquid: the preview updates without a reload and keeps its scroll position
        await kitPage.evaluate(() => {
            (window as unknown as { kitAlive: boolean }).kitAlive = true;
            window.scrollTo(0, 600);
        });
        const body = path.join(kit, 'template', 'template.liquid');
        const original = readFileSync(body, 'utf8');
        writeFileSync(body, `<p id="toolkit-marker">Toolkit check Hafenkontor</p>\n${original}`);
        const firstPage = kitPage.locator('.pp-page[data-page="1"] .pp-clip iframe').contentFrame();
        await expect(firstPage.locator('#toolkit-marker')).toHaveText('Toolkit check Hafenkontor', { timeout: 15_000 });
        expect(await kitPage.evaluate(() => (window as unknown as { kitAlive?: boolean }).kitAlive)).toBe(true);
        expect(Math.abs((await kitPage.evaluate(() => window.scrollY)) - 600)).toBeLessThanOrEqual(2);

        // 5. a Liquid error shows the overlay with file and line, fixing it removes the overlay
        writeFileSync(body, `{{ document.number | nope }}\n<p id="toolkit-marker">Toolkit check Hafenkontor</p>\n${original}`);
        const overlay = kitPage.getByRole('alert', { name: 'Template problems' });
        await expect(overlay).toContainText('template.liquid:1', { timeout: 15_000 });
        writeFileSync(body, `<p id="toolkit-marker">Toolkit check Hafenkontor</p>\n${original}`);
        await expect(overlay).toHaveCount(0, { timeout: 15_000 });

        // review screenshots of the preview page (Task 16)
        await kitPage.evaluate(() => window.scrollTo(0, 0));
        await kitPage.emulateMedia({ colorScheme: 'light' });
        await kitPage.screenshot({ path: path.join(SCREENSHOTS, 'toolkit-1440-light.png') });
        await kitPage.emulateMedia({ colorScheme: 'dark' });
        await kitPage.screenshot({ path: path.join(SCREENSHOTS, 'toolkit-1440-dark.png') });

        // 6. pnpm push writes the change to openbill
        execFileSync('pnpm', ['push'], { cwd: kit, env: nodeEnv, stdio: 'inherit', timeout: 60_000 });
        const saved = (await apiGet(page, `/api/templates/${copy.id}`)) as { body: string };
        expect(saved.body).toContain('Toolkit check Hafenkontor');

        // 7. pnpm run pack makes a package the import accepts
        execFileSync('pnpm', ['run', 'pack'], { cwd: kit, env: nodeEnv, stdio: 'inherit', timeout: 60_000 });
        const packed = readdirSync(kit).find((name) => name.endsWith('.zip'));
        expect(packed).toBeDefined();
        const xsrf = (await page.context().cookies()).find((cookie) => cookie.name === 'XSRF-TOKEN')?.value ?? '';
        const imported = await page.request.post('/api/templates', {
            multipart: { package: { name: packed!, mimeType: 'application/zip', buffer: readFileSync(path.join(kit, packed!)) } },
            headers: { Accept: 'application/json', Referer: page.url(), 'X-XSRF-TOKEN': decodeURIComponent(xsrf) },
        });
        expect(imported.status(), await imported.text()).toBe(201);
        await apiDelete(page, `/api/templates/${((await imported.json()) as { id: string }).id}`);
    } finally {
        if (dev?.pid) {
            try {
                process.kill(-dev.pid, 'SIGTERM');
            } catch {
                // already gone
            }
        }
        // deleting the template deletes its toolkit token, too
        await apiDelete(page, `/api/templates/${copy.id}`);
    }
});
