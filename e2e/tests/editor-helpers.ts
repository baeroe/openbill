import { expect, type Locator, type Page } from '@playwright/test';

export const heading = (page: Page) => page.getByRole('heading', { level: 1 });

/** Creates a draft through the "New document" dialog and returns its id. */
export async function newDocument(page: Page, type: 'Quote' | 'Invoice', customer: RegExp): Promise<string> {
    await page.goto('/en/documents');
    await page.getByRole('button', { name: 'New document' }).first().click();
    const dialog = page.getByRole('dialog', { name: 'New document' });
    await dialog.getByRole('radio', { name: new RegExp(type) }).click();
    await dialog.getByRole('radio', { name: customer }).click();
    await dialog.getByRole('button', { name: `Create ${type}` }).click();
    await expect(page).toHaveURL(/\/en\/documents\/[0-9a-z]{26}$/);
    return page.url().split('/').pop()!;
}

/** Autosave waits 600 ms after the last change; then the status reads "Saved" again. */
export async function settle(page: Page): Promise<void> {
    await page.waitForTimeout(700);
    await expect(page.getByTestId('save-status')).toHaveText('Saved', { timeout: 10_000 });
}

/** Fills row `index` of a group (or of the page) with title, quantity and unit price. */
export async function fillRow(scope: Locator, index: number, title: string, quantity: string, price: string): Promise<void> {
    const row = scope.locator('[data-position-row]').nth(index);
    const name = row.getByRole('combobox', { name: 'Item' });
    await name.fill(title);
    await name.press('Escape'); // close the suggestions of earlier documents
    await row.getByRole('textbox', { name: 'Quantity' }).fill(quantity);
    const price_ = row.getByRole('textbox', { name: 'Unit price' });
    await price_.fill(price);
    await price_.press('Tab');
}

export async function finalize(page: Page, type: string): Promise<void> {
    await page.getByRole('button', { name: 'Finalize', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: `Finalize ${type}?` });
    await dialog.getByRole('button', { name: 'Finalize' }).click();
    await expect(dialog).toBeHidden();
}

/** Today in the time zone of the browser (playwright.config: Europe/Berlin) as YYYY-MM-DD. */
export const today = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Berlin' });
