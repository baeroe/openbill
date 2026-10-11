import { expect, test } from '@playwright/test';
import { apiGet, login } from './helpers';

test.beforeEach(async ({ page }) => {
    await login(page);
});

test('creates a customer with a contact over the API', async ({ page }) => {
    await page.goto('/en/customers');
    await page.getByRole('link', { name: 'New customer' }).click();
    await page.getByLabel('Name', { exact: true }).fill('Werkstatt Morgenrot');
    await page.getByLabel('City', { exact: true }).fill('Lübeck');

    await page.getByRole('button', { name: 'Add', exact: true }).click();
    const drawer = page.getByRole('dialog', { name: 'Add contact' });
    await drawer.getByLabel('First name').fill('Lena');
    await drawer.getByLabel('Last name').fill('Sommer');
    await drawer.getByLabel('Email').fill('lena@morgenrot.example');
    await drawer.getByRole('button', { name: 'Add', exact: true }).click();

    await page.getByRole('button', { name: 'Create customer' }).first().click();
    await expect(page.getByText('Customer created')).toBeVisible();
    await expect(page).toHaveURL(/\/en\/customers\/[0-9a-z]{26}$/);

    await page.reload();
    await expect(page.getByLabel('Name', { exact: true })).toHaveValue('Werkstatt Morgenrot');
    await expect(page.getByRole('button', { name: 'Lena Sommer', exact: true })).toBeVisible();

    await page.getByRole('link', { name: 'All customers' }).click();
    await page.getByLabel('Search customers').fill('Morgenrot');
    await expect(page.getByRole('link', { name: /Werkstatt Morgenrot/ }).first()).toBeVisible();
});

test('shows API validation at the field and saves nothing (review focus)', async ({ page }) => {
    await page.goto('/en/customers');
    await page.getByRole('link', { name: /Hafenkontor Lindqvist GmbH/ }).click();
    await expect(page).toHaveURL(/\/en\/customers\/[0-9a-z]{26}$/);
    const id = page.url().split('/').pop();

    const email = page.getByLabel('Email for invoices');
    await email.fill('not-an-email');
    await page.getByRole('button', { name: 'Save', exact: true }).first().click();

    await expect(page.getByText('The email field must be a valid email address.')).toBeVisible();
    await expect(email).toHaveAttribute('aria-invalid', 'true');
    const saved = (await apiGet(page, `/api/customers/${id}`)) as { email: string };
    expect(saved.email).toBe('buchhaltung@hafenkontor.example');
});

test('asks before leaving unsaved changes (review focus)', async ({ page }) => {
    await page.goto('/en/customers');
    await page.getByRole('link', { name: /Hotel Alpenglück/ }).click();
    await expect(page).toHaveURL(/\/en\/customers\/[0-9a-z]{26}$/);
    const url = page.url();

    await page.getByLabel('Name', { exact: true }).fill('Hotel Alpenglück & Spa');
    let asked = '';
    page.once('dialog', async (dialog) => {
        asked = dialog.message();
        await dialog.dismiss();
    });
    await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name: 'Customers' }).click();

    await expect.poll(() => asked).toContain('Unsaved changes are lost');
    expect(page.url()).toBe(url);
    await expect(page.getByRole('region', { name: 'Unsaved changes' })).toBeVisible();
});
