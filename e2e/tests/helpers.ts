import path from 'node:path';
import { expect, type Page } from '@playwright/test';

/** Session of the setup project (git-ignored), shared by all tests that do not test the login itself. */
export const AUTH_FILE = path.resolve(import.meta.dirname, '../.auth/user.json');

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

/** A write against the API with the page's session: Sanctum needs the Referer and the XSRF cookie as header. */
export async function apiPost(page: Page, url: string, body: unknown = {}): Promise<unknown> {
    const xsrf = (await page.context().cookies()).find((cookie) => cookie.name === 'XSRF-TOKEN')?.value ?? '';
    const response = await page.request.post(url, {
        data: body,
        headers: { Accept: 'application/json', Referer: page.url(), 'X-XSRF-TOKEN': decodeURIComponent(xsrf) },
    });
    expect(response.ok(), await response.text()).toBe(true);
    return response.json();
}

/** PATCH with the page's session (merge patch), e.g. to give a draft its groups before a test. */
export async function apiPatch(page: Page, url: string, body: unknown): Promise<unknown> {
    const xsrf = (await page.context().cookies()).find((cookie) => cookie.name === 'XSRF-TOKEN')?.value ?? '';
    const response = await page.request.patch(url, {
        data: body,
        headers: { Accept: 'application/json', 'Content-Type': 'application/merge-patch+json', Referer: page.url(), 'X-XSRF-TOKEN': decodeURIComponent(xsrf) },
    });
    expect(response.ok(), await response.text()).toBe(true);
    return response.json();
}

/** DELETE with the page's session (cleanup after a test). */
export async function apiDelete(page: Page, url: string): Promise<void> {
    const xsrf = (await page.context().cookies()).find((cookie) => cookie.name === 'XSRF-TOKEN')?.value ?? '';
    const response = await page.request.delete(url, { headers: { Accept: 'application/json', Referer: page.url(), 'X-XSRF-TOKEN': decodeURIComponent(xsrf) } });
    expect(response.ok(), await response.text()).toBe(true);
}

/** Text of a PDF (unpdf/pdf.js): drafts come rendered live, finalized documents from the archive. */
export async function pdfText(page: Page, url: string): Promise<string> {
    const { extractText, getDocumentProxy } = await import('unpdf');
    const response = await page.request.get(url, { headers: { Referer: page.url() } });
    expect(response.headers()['content-type']).toContain('application/pdf');
    const pdf = await getDocumentProxy(new Uint8Array(await response.body()));
    const { text } = await extractText(pdf, { mergePages: true });
    return text;
}
