import { expect, test } from '@playwright/test';
import { apiPost } from './helpers';

test('invite by link, accept in a fresh browser, disable and enable again', async ({ page, browser }) => {
    const suffix = Date.now().toString(36);
    // e2e.* accounts are removed by E2eUserSeeder before every run
    const email = `e2e.nina.${suffix}@example.com`;
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

    // leave the account disabled; the seeder removes it before the next run
    await page.getByRole('button', { name: `Disable ${name}` }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Disable' }).click();
    // the toast of the first disabling may still be there (slow CI): two toasts with the same text
    await expect(page.getByText(`${name} disabled`).last()).toBeVisible();
    await expect(page.getByRole('listitem').filter({ hasText: email }).getByText('Disabled')).toBeVisible();
});

test('lays out the user list on a phone (review #4)', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/en/settings/users');
    const row = page.getByRole('listitem').filter({ hasText: 'e2e@example.com' });
    const avatar = row.locator('span').first();
    const name = row.getByText('Erik Ende');
    const role = row.getByRole('combobox');
    await expect(role).toBeVisible();

    const [a, n, r, li] = await Promise.all([avatar.boundingBox(), name.boundingBox(), role.boundingBox(), row.boundingBox()]);
    // avatar left, name to its right, role below the name, nothing outside the row
    expect(a!.x).toBeLessThan(n!.x);
    expect(r!.y).toBeGreaterThan(n!.y);
    expect(Math.abs(r!.x - n!.x)).toBeLessThan(2);
    expect(r!.width).toBeGreaterThanOrEqual(150);
    expect(r!.x + r!.width).toBeLessThanOrEqual(li!.x + li!.width);
    expect(await role.evaluate((el: HTMLSelectElement) => el.scrollWidth <= el.clientWidth)).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
    await page.screenshot({ path: test.info().outputPath('users-390.png'), fullPage: true });
});

test('changes the own password in Settings → Your account (review I2)', async ({ page, browser }) => {
    const suffix = Date.now().toString(36);
    // a fresh account: changing the password signs out its other sessions, never the shared e2e session
    const email = `e2e.pia.${suffix}@example.com`;
    await page.goto('/en/settings/users');
    const invitation = (await apiPost(page, '/api/invitations', { email, role: 'member' })) as { link: string };

    const guest = await browser.newContext({ storageState: { cookies: [], origins: [] }, ignoreHTTPSErrors: true });
    const own = await guest.newPage();
    await own.goto(invitation.link);
    await own.getByLabel('Your name').fill(`Pia Pass ${suffix}`);
    await own.getByLabel('Password', { exact: true }).fill('first-password');
    await own.getByLabel('Repeat password').fill('first-password');
    await own.getByRole('button', { name: 'Create account' }).click();
    await expect(own).toHaveURL(/\/en$/);

    await own.goto('/en/settings/account');
    await expect(own.getByText(email)).toBeVisible();
    await own.getByLabel('Current password', { exact: true }).fill('wrong-password');
    await own.getByLabel('New password', { exact: true }).fill('second-password');
    await own.getByLabel('Repeat the new password').fill('second-password');
    await own.getByRole('button', { name: 'Change password' }).click();
    await expect(own.getByText('The current password is not correct.')).toBeVisible();

    await own.getByLabel('Current password', { exact: true }).fill('first-password');
    await own.getByRole('button', { name: 'Change password' }).click();
    await expect(own.getByText('Password changed. Other sessions were signed out.')).toBeVisible();
    await expect(own.getByLabel('Current password', { exact: true })).toHaveValue('');
    // this session stays signed in
    await own.goto('/en/settings/account');
    await expect(own.getByText(email)).toBeVisible();
    await guest.close();
});
