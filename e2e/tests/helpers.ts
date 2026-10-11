import { expect, type Page } from '@playwright/test';

/** Login of database/seeders/E2eUserSeeder.php (fictional). */
export const USER = { email: 'e2e@example.com', password: 'e2e-password', name: 'Erik Ende' };

export async function login(page: Page, locale: 'en' | 'de' = 'en'): Promise<void> {
    const de = locale === 'de';
    await page.goto(`/${locale}/login`);
    await page.getByLabel(de ? 'E-Mail' : 'Email', { exact: true }).fill(USER.email);
    await page.getByLabel(de ? 'Passwort' : 'Password', { exact: true }).fill(USER.password);
    await page.getByRole('button', { name: de ? 'Anmelden' : 'Log in' }).click();
    await expect(page).toHaveURL(new RegExp(`/${locale}$`));
}

/** The session cookie of the page, for checks against the API (Sanctum needs a Referer of the own host). */
export async function apiGet(page: Page, url: string): Promise<unknown> {
    const response = await page.request.get(url, { headers: { Accept: 'application/json', Referer: page.url() } });
    expect(response.ok()).toBe(true);
    return response.json();
}
