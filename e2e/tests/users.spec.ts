import { expect, test } from '@playwright/test';

test('invite by link, accept in a fresh browser, disable and enable again', async ({ page, browser }) => {
    const suffix = Date.now().toString(36);
    const email = `nina.${suffix}@example.com`;
    const name = `Nina Nordlicht ${suffix}`;
    await page.goto('/en/settings/users');
    await page.getByRole('button', { name: 'Invite' }).click();
    const dialog = page.getByRole('dialog', { name: 'Invite user' });
    await dialog.getByLabel('Email').fill(email);
    await dialog.getByRole('button', { name: 'Create invitation link' }).click();
    const link = await page.getByRole('dialog', { name: 'Invitation created' }).getByLabel('Invitation link').inputValue();
    expect(link).toContain('/en/invitations/');
    await page.getByRole('dialog', { name: 'Invitation created' }).getByRole('button', { name: 'Close' }).first().click();

    const guest = await browser.newContext({ storageState: { cookies: [], origins: [] }, ignoreHTTPSErrors: true });
    const invited = await guest.newPage();
    await invited.goto(link);
    await expect(invited.getByLabel('Email')).toHaveValue(email);
    await invited.getByLabel('Your name').fill(name);
    await invited.getByLabel('Password', { exact: true }).fill('long-enough-password');
    await invited.getByLabel('Repeat password').fill('long-enough-password');
    await invited.getByRole('button', { name: 'Create account' }).click();
    await expect(invited).toHaveURL(/\/en$/);
    await guest.close();

    await page.reload();
    await expect(page.getByText(email)).toBeVisible();
    await page.getByRole('button', { name: `Disable ${name}` }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Disable' }).click();
    await expect(page.getByText(`${name} disabled`)).toBeVisible();
    await expect(page.getByRole('listitem').filter({ hasText: email }).getByText('Disabled')).toBeVisible();

    // a disabled account cannot log in and gets its own message
    const again = await browser.newContext({ storageState: { cookies: [], origins: [] }, ignoreHTTPSErrors: true });
    const login = await again.newPage();
    await login.goto(new URL('/en/login', link).toString());
    await login.getByLabel('Email', { exact: true }).fill(email);
    await login.getByLabel('Password', { exact: true }).fill('long-enough-password');
    await login.getByRole('button', { name: 'Log in' }).click();
    await expect(login.getByText('This account is disabled. Ask an owner to enable it again.')).toBeVisible();
    await again.close();

    await page.getByRole('button', { name: `Enable ${name} again` }).click();
    await expect(page.getByText(`${name} enabled again`)).toBeVisible();
});
