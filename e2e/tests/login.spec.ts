import { expect, test } from '@playwright/test';
import { login, USER } from './helpers';

// these tests log in themselves: no shared session
test.use({ storageState: { cookies: [], origins: [] } });

test('logs in, shows the overview and logs out', async ({ page }) => {
    await login(page);

    await expect(page.getByRole('heading', { level: 1 })).toContainText('Erik');
    await expect(page.getByRole('region', { name: 'Key figures' })).toBeVisible();

    await page.getByRole('button', { name: 'Account menu' }).click();
    await page.getByRole('menuitem', { name: 'Log out' }).click();
    await expect(page).toHaveURL(/\/en\/login$/);
    // the session is really gone
    await page.goto('/en/documents');
    await expect(page).toHaveURL(/\/en\/login$/);
});

test('stays signed in and says so when logging out fails', async ({ page }) => {
    await login(page);
    await page.route('**/en/logout', (route) => route.abort('internetdisconnected'));

    await page.getByRole('button', { name: 'Account menu' }).click();
    await page.getByRole('menuitem', { name: 'Log out' }).click();

    await expect(page.getByText('Logging out did not work. Please try again.')).toBeVisible();
    await expect(page).not.toHaveURL(/\/login$/);
    await page.unroute('**/en/logout');
    await page.reload();
    await expect(page.getByRole('region', { name: 'Key figures' })).toBeVisible();
});

test('refuses a wrong password with a message at the field', async ({ page }) => {
    await page.goto('/en/login');
    await page.getByLabel('Email', { exact: true }).fill(USER.email);
    await page.getByLabel('Password', { exact: true }).fill('wrong-password');
    await page.getByRole('button', { name: 'Log in' }).click();

    await expect(page.getByText('Email or password is incorrect.')).toBeVisible();
    await expect(page).toHaveURL(/\/en\/login$/);
});

test('works in German', async ({ page }) => {
    await login(page, 'de');

    await expect(page.getByRole('navigation', { name: 'Hauptnavigation' }).getByRole('link', { name: 'Kunden' })).toBeVisible();
});

test('opens "New document" with the key N and closes it with Escape', async ({ page }) => {
    await login(page);

    await page.keyboard.press('n');
    await expect(page.getByRole('dialog', { name: 'New document' })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toBeHidden();
});
