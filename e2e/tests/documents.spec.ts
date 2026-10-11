import { expect, test } from '@playwright/test';
import { login } from './helpers';

test.beforeEach(async ({ page }) => {
    await login(page);
    await page.goto('/en/documents');
    await expect(page.locator('a[href^="/en/documents/"]').first()).toBeVisible();
});

const rows = (page: import('@playwright/test').Page) => page.locator('main a[href^="/en/documents/"]');

test('puts filters into the URL and restores the previous filter on back', async ({ page }) => {
    await page.getByRole('button', { name: /^Invoices/ }).click();
    await expect(page).toHaveURL(/\/en\/documents\?type=invoice$/);

    await page.getByLabel('Filter by status').selectOption('overdue');
    await expect(page).toHaveURL(/type=invoice/);
    await expect(page).toHaveURL(/status=overdue/);
    await expect(rows(page)).toHaveCount(1);
    await expect(page.getByText('1 document', { exact: true })).toBeVisible();

    await page.goBack();
    await expect(page).toHaveURL(/\/en\/documents\?type=invoice$/);
    await expect(page.getByLabel('Filter by status')).toHaveValue('');
    await expect(rows(page)).toHaveCount(3);
});

test('keeps the search when a pill is clicked while the search is still loading (review focus)', async ({ page }) => {
    const searching = page.waitForRequest((request) => request.url().includes('/en/documents?q=Fjord'));
    await page.getByLabel('Search documents').fill('Fjord');
    await searching;
    // the search visit is on its way: the pill must not drop it
    await page.getByRole('button', { name: /^Invoices/ }).click();

    await expect(page).toHaveURL(/type=invoice/);
    await expect(page).toHaveURL(/q=Fjord/);
    await page.waitForTimeout(800);
    await expect(page).toHaveURL(/q=Fjord/);
    await expect(page.getByLabel('Search documents')).toHaveValue('Fjord');
    await expect(rows(page)).toHaveCount(1);
});

test('keeps both filters when two selects change in quick succession (review focus)', async ({ page }) => {
    await page.getByLabel('Filter by status').selectOption('open');
    await page.getByLabel('Filter by customer').selectOption({ label: 'Hafenkontor Lindqvist GmbH' });

    await expect(page).toHaveURL(/status=open/);
    await expect(page).toHaveURL(/customer_id=/);
    await page.waitForTimeout(800);
    await expect(page).toHaveURL(/status=open/);
    await expect(page.getByLabel('Filter by status')).toHaveValue('open');
});

test('draws selects as tinted fields, not as read-only outlines', async ({ page }) => {
    const style = await page.getByLabel('Filter by status').evaluate((element) => {
        const css = getComputedStyle(element);
        return { background: css.backgroundColor, shadow: css.boxShadow };
    });

    expect(style.background).not.toBe('rgba(0, 0, 0, 0)');
    expect(style.shadow).toBe('none');
});

test('creates a document from the dialog and opens it', async ({ page }) => {
    await page.getByRole('button', { name: 'New document' }).first().click();
    const dialog = page.getByRole('dialog', { name: 'New document' });
    await dialog.getByRole('radio', { name: /Invoice/ }).click();
    await dialog.getByRole('radio', { name: /Hotel Alpenglück/ }).click();
    await dialog.getByRole('button', { name: 'Create Invoice' }).click();

    await expect(page).toHaveURL(/\/en\/documents\/[0-9a-z]{26}$/);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Invoice (draft)');
    // the customer select carries the name too: look at the editor header
    await expect(page.locator('.ed-head').getByText('Hotel Alpenglück')).toBeVisible();
});
