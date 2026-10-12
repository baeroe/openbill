import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { expect, test } from '@playwright/test';
import { apiDelete, apiGet, apiPost } from './helpers';

test('gallery renders previews; built-ins are read-only', async ({ page }) => {
    await page.goto('/en/templates');
    for (const name of ['Klar', 'Kante', 'Leise']) {
        await expect(page.getByRole('heading', { name, exact: true })).toBeVisible();
    }
    await expect(page.locator('.pp-page').first()).toBeVisible({ timeout: 15_000 });

    await page.getByRole('link', { name: 'View Klar' }).click();
    await expect(page.getByRole('button', { name: 'Duplicate to customize' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Save', exact: true })).toHaveCount(0);
    await expect(page.getByText('Built-in, read-only')).toBeVisible();
});

test('shows template errors with file and line and marks them in the code (review focus)', async ({ page }) => {
    await page.goto('/en/templates');
    const templates = (await apiGet(page, '/api/templates')) as { id: string; slug: string }[];
    const klar = templates.find((t) => t.slug === 'klar')!;
    const copy = (await apiPost(page, `/api/templates/${klar.id}/duplicate`)) as { id: string };

    try {
        await page.goto(`/en/templates/${copy.id}`);
        await page.locator('.cm-content').click();
        await page.keyboard.press('ControlOrMeta+End');
        await page.keyboard.press('Enter');
        await page.keyboard.insertText('{{ document.number | nope }}');

        const errors = page.getByText('Template errors').locator('..');
        await expect(errors).toContainText('template.liquid:', { timeout: 15_000 });
        await expect(page.locator('.cm-lintRange-error')).toHaveCount(1);

        await page.keyboard.press('ControlOrMeta+z');
        await expect(page.locator('.cm-lintRange-error')).toHaveCount(0, { timeout: 15_000 });
        await expect(page.getByText('Template errors')).toHaveCount(0);
    } finally {
        await apiDelete(page, `/api/templates/${copy.id}`);
    }
});

test('imports a template package and deletes it again', async ({ page }) => {
    await page.goto('/en/templates');
    const templates = (await apiGet(page, '/api/templates')) as { id: string; slug: string }[];
    const kante = templates.find((t) => t.slug === 'kante')!;
    const zip = await page.request.get(`/api/templates/${kante.id}/package`, { headers: { Referer: page.url() } });
    const file = path.join(mkdtempSync(path.join(tmpdir(), 'openbill-e2e-')), 'kante.zip');
    writeFileSync(file, await zip.body());

    await page.locator('input[type=file][accept*="zip"]').setInputFiles(file);
    await expect(page.getByText('“Kante” imported')).toBeVisible();
    const imported = page.getByRole('article').filter({ has: page.getByRole('heading', { name: 'Kante', exact: true }) }).filter({ hasNot: page.getByText('Built-in') });
    await imported.getByRole('button', { name: 'More actions' }).click();
    await page.getByRole('menuitem', { name: 'Delete' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Delete' }).click();
    await expect(page.getByText('“Kante” deleted')).toBeVisible();
});
