import { expect, test } from '@playwright/test';
import { apiGet, apiPatch } from './helpers';

const TINY_PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');

test('organization: register number, logo and the jump from the compliance panel', async ({ page }) => {
    await page.goto('/en/settings/organization?focus=org.iban');
    const before = (await apiGet(page, '/api/organization')) as { registration_id: string };
    await expect(page.getByLabel('IBAN')).toBeFocused();

    try {
        await page.getByLabel('Register number').fill('HRB 000000 Demo');
        await page.getByRole('button', { name: 'Save', exact: true }).click();
        await expect(page.getByText('Organization saved')).toBeVisible();
        await page.reload();
        await expect(page.getByLabel('Register number')).toHaveValue('HRB 000000 Demo');

        await page.locator('input[type=file][accept*="image/png"]').setInputFiles({ name: 'logo.png', mimeType: 'image/png', buffer: TINY_PNG });
        await expect(page.getByText('Logo saved')).toBeVisible();
        await expect(page.getByRole('img', { name: 'Logo' })).toBeVisible();
        await page.getByRole('button', { name: 'Remove' }).click();
        await expect(page.getByRole('img', { name: 'Logo' })).toHaveCount(0);
    } finally {
        await apiPatch(page, '/api/organization', { registration_id: before.registration_id });
    }
});

test('document types: the number preview follows the pattern', async ({ page }) => {
    await page.goto('/en/settings/document-types');
    const pattern = page.getByLabel('Pattern');
    await pattern.fill('RE-{YY}-{000}');
    await expect(page.getByText(/^RE-\d{2}-\d{3}$/)).toBeVisible();
    await pattern.fill('RE-{YY}');
    await expect(page.getByText('The pattern needs a running number, e.g. {0000}.')).toBeVisible();
    await page.getByRole('button', { name: 'Discard' }).click();
});

test('taxes: archive with undo', async ({ page }) => {
    await page.goto('/en/settings/taxes-units');
    const first = page.getByRole('button', { name: /^Archive / }).first();
    const name = ((await first.textContent()) ?? '').replace(/^Archive /, '');
    await first.click();
    await expect(page.getByText(`“${name}” archived`)).toBeVisible();
    await page.getByRole('button', { name: 'Undo' }).click();
    await expect(page.getByText(`“${name}” restored`)).toBeVisible();
});

test('text blocks: create and delete with undo', async ({ page }) => {
    await page.goto('/en/settings/text-blocks');
    await page.getByRole('button', { name: 'Text block', exact: true }).click();
    const drawer = page.getByRole('dialog', { name: 'New text block' });
    await drawer.getByLabel('Name').fill('Thanks Elbinsel');
    await drawer.getByLabel('Text').fill('Thank you, {{ customer.name }}.');
    await drawer.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByText('Text block “Thanks Elbinsel” saved')).toBeVisible();

    await page.getByRole('button', { name: 'Delete Thanks Elbinsel' }).click();
    await page.getByRole('button', { name: 'Undo' }).click();
    await expect(page.getByRole('button', { name: /^Thanks Elbinsel/ })).toBeVisible();
    await page.getByRole('button', { name: 'Delete Thanks Elbinsel' }).click();
});
