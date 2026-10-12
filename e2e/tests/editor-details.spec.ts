import { expect, test } from '@playwright/test';
import { fillRow, heading, newDocument, settle } from './editor-helpers';
import { apiGet, apiPost } from './helpers';

type Doc = { intro: string; gross_total: string; groups: { positions: { title: string; quantity: string }[] }[] };

test.beforeEach(async ({ page }) => {
    await page.goto('/en'); // signed in through the setup project (storageState)
});

test('keeps typing during a save and new positions across a reload, without duplicates (review focus 1)', async ({ page }) => {
    const id = await newDocument(page, 'Invoice', /Hotel Alpenglück/);
    const loose = page.getByRole('group', { name: 'Loose positions' });

    await loose.getByRole('button', { name: 'Add position' }).click();
    const first = loose.locator('[data-position-row]').nth(0).getByRole('combobox', { name: 'Item' });
    await first.pressSequentially('Zimmer');
    await page.waitForTimeout(650); // the first save (new position with a local id) is on its way …
    await first.pressSequentially('reinigung'); // … while typing goes on in the same field
    await expect(first).toBeFocused();
    await first.press('Escape');

    await loose.getByRole('button', { name: 'Add position' }).click();
    await loose.locator('[data-position-row]').nth(1).getByRole('combobox', { name: 'Item' }).pressSequentially('Wäscheservice');
    await settle(page);

    await page.reload();
    const rows = page.getByRole('group', { name: 'Loose positions' }).locator('[data-position-row]');
    await expect(rows).toHaveCount(2);
    await expect(rows.nth(0).getByRole('combobox', { name: 'Item' })).toHaveValue('Zimmerreinigung');
    await expect(rows.nth(1).getByRole('combobox', { name: 'Item' })).toHaveValue('Wäscheservice');
    const saved = (await apiGet(page, `/api/documents/${id}`)) as Doc;
    expect(saved.groups.flatMap((g) => g.positions.map((p) => p.title))).toEqual(['Zimmerreinigung', 'Wäscheservice']);
});

test('saves before leaving the page (review focus 5)', async ({ page }) => {
    const id = await newDocument(page, 'Quote', /Kulturwerk Elbinsel/);

    await page.getByLabel('Introduction').fill('Hallo Jana, wie besprochen:');
    await page.getByRole('link', { name: 'Documents', exact: true }).first().click();
    await expect(page).toHaveURL(/\/en\/documents$/);

    await expect.poll(async () => ((await apiGet(page, `/api/documents/${id}`)) as Doc).intro).toBe('Hallo Jana, wie besprochen:');
});

test('stops saving and turns read-only when the document is finalized elsewhere (review focus 2)', async ({ page }) => {
    const id = await newDocument(page, 'Quote', /Hafenkontor Lindqvist/);
    const loose = page.getByRole('group', { name: 'Loose positions' });
    await loose.getByRole('button', { name: 'Add position' }).click();
    await fillRow(loose, 0, 'Beratung', '1', '100');
    await settle(page);

    // another client (API token, MCP, second tab) finalizes the draft
    await apiPost(page, `/api/documents/${id}/finalize`);
    await page.getByLabel('Introduction').fill('Noch eine Änderung');

    await expect(page.getByText(/This document was finalized elsewhere/)).toBeVisible();
    await expect(page.getByLabel('Introduction')).toBeDisabled();
    await expect(heading(page)).toHaveAccessibleName(/^Quote AN-\d{4}-\d{4}$/);
    expect(((await apiGet(page, `/api/documents/${id}`)) as Doc).intro).not.toBe('Noch eine Änderung');
});

test('gives a position added right after opening the editor the default tax rate and unit (flake of review focus 2)', async ({ page }) => {
    const id = await newDocument(page, 'Quote', /Hafenkontor Lindqvist/);
    // a full page load with slow master data: "Add position" must wait for the tax rates and units
    await page.route('**/api/tax-rates*', async (route) => {
        await new Promise((resolve) => setTimeout(resolve, 1500));
        await route.continue();
    });
    await page.reload();
    const loose = page.getByRole('group', { name: 'Loose positions' });
    await loose.getByRole('button', { name: 'Add position' }).click();
    await fillRow(loose, 0, 'Beratung', '1', '100');
    await settle(page);

    const doc = (await apiGet(page, `/api/documents/${id}`)) as { groups: { positions: { tax_rate_id: string | null; unit_id: string | null }[] }[] };
    expect(doc.groups.flatMap((group) => group.positions).map((position) => [position.tax_rate_id !== null, position.unit_id !== null])).toEqual([[true, true]]);
});

test('shows the totals of the server after fast typing (review focus 3)', async ({ page }) => {
    const id = await newDocument(page, 'Invoice', /Hafenkontor Lindqvist/);
    const loose = page.getByRole('group', { name: 'Loose positions' });
    await loose.getByRole('button', { name: 'Add position' }).click();
    const row = loose.locator('[data-position-row]').nth(0);
    await row.getByRole('combobox', { name: 'Item' }).fill('Workshop');
    await row.getByRole('combobox', { name: 'Item' }).press('Escape');

    const price = row.getByRole('textbox', { name: 'Unit price' });
    await price.click(); // selects the "0.00" of the new row, typing replaces it
    await price.pressSequentially('1234,5', { delay: 40 }); // six renders requested, older ones are aborted
    await price.press('Tab');
    await settle(page);

    // 1234.50 + 19 % (234.555 → 234.56) = 1469.06
    expect(((await apiGet(page, `/api/documents/${id}`)) as Doc).gross_total).toBe('1469.06');
    await expect(page.getByRole('group', { name: 'Totals' })).toContainText('€1,469.06');
    await expect(row.getByLabel('Total of the position')).toHaveText('€1,234.50');
});

test('marks an invalid number and never sends it (review focus 4)', async ({ page }) => {
    const id = await newDocument(page, 'Quote', /Hafenkontor Lindqvist/);
    const bodies: string[] = [];
    page.on('request', (request) => {
        if (request.method() === 'PATCH' && request.url().endsWith(`/api/documents/${id}`)) bodies.push(request.postData() ?? '');
    });

    const loose = page.getByRole('group', { name: 'Loose positions' });
    await loose.getByRole('button', { name: 'Add position' }).click();
    const row = loose.locator('[data-position-row]').nth(0);
    await row.getByRole('combobox', { name: 'Item' }).fill('Beratung');
    const quantity = row.getByRole('textbox', { name: 'Quantity' });

    await quantity.fill('abc');
    await quantity.press('Tab');
    await expect(quantity).toHaveAttribute('aria-invalid', 'true');
    await expect(quantity).toHaveAttribute('title', /Enter a number/);
    await settle(page);
    expect(bodies.some((body) => body.includes('abc'))).toBe(false);

    await quantity.fill('1,5');
    await quantity.press('Tab');
    await expect(quantity).not.toHaveAttribute('aria-invalid', 'true');
    await settle(page);
    const saved = (await apiGet(page, `/api/documents/${id}`)) as Doc;
    expect(Number(saved.groups.flatMap((g) => g.positions)[0].quantity)).toBe(1.5);
});

test('deletes a draft with undo, and for good once the toast is gone (review focus 5)', async ({ page }) => {
    const id = await newDocument(page, 'Quote', /Hafenkontor Lindqvist/);

    await page.getByRole('button', { name: 'More actions' }).click();
    await page.getByRole('menuitem', { name: 'Delete draft' }).click();
    await expect(page).toHaveURL(/\/en\/documents$/);
    await expect(page.locator(`main a[href="/en/documents/${id}"]`)).toHaveCount(0);
    await page.getByRole('button', { name: 'Undo' }).click();
    await expect(page).toHaveURL(new RegExp(`/en/documents/${id}$`));
    await expect(heading(page)).toHaveAccessibleName('Quote (draft)');

    await page.getByRole('button', { name: 'More actions' }).click();
    await page.getByRole('menuitem', { name: 'Delete draft' }).click();
    await expect(page).toHaveURL(/\/en\/documents$/);
    await page.mouse.move(0, 0); // a pointer on the toast would pause it
    await expect(page.getByText('Draft deleted')).toBeHidden({ timeout: 10_000 });
    await expect
        .poll(async () => (await page.request.get(`/api/documents/${id}`, { headers: { Accept: 'application/json', Referer: page.url() } })).status())
        .toBe(404);
});
