import { expect, test } from '@playwright/test';
import { finalize, heading, settle } from './editor-helpers';

test('writes a text document with a clause, previews it, finalizes it and duplicates it', async ({ page }) => {
    // a clause as text block
    await page.goto('/en/settings/text-blocks');
    await page.getByRole('button', { name: 'Text block', exact: true }).click();
    const drawer = page.getByRole('dialog', { name: 'New text block' });
    await drawer.getByLabel('Name').fill('Liability clause');
    await drawer.getByLabel('Kind').selectOption('clause');
    await drawer.getByLabel('Text').fill('## Liability\n\nWe are liable for intent and gross negligence.');
    await drawer.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByText('Text block “Liability clause” saved')).toBeVisible();

    // a text document without a customer
    await page.goto('/en/documents');
    await page.getByRole('button', { name: 'New document' }).first().click();
    const dialog = page.getByRole('dialog', { name: 'New document' });
    await dialog.getByRole('radio', { name: /Text document/ }).click();
    await dialog.getByRole('button', { name: 'Create Text document' }).click();
    await expect(page).toHaveURL(/\/en\/documents\/[0-9a-z]{26}$/);
    await expect(heading(page)).toHaveAccessibleName('Text document (draft)');
    await expect(page.getByText('Positions', { exact: true })).toHaveCount(0);

    await page.getByLabel('Title', { exact: true }).fill('General terms and conditions');
    const body = page.getByRole('textbox', { name: /^Text/ });
    await body.fill('## Scope\n\nThese terms apply to all contracts.');
    await page.getByLabel('Short name').fill('Terms E2E');
    await expect(page.getByLabel('Short name')).toHaveValue('terms-e2e');

    // the clause goes in at the cursor (end of the text)
    await body.click();
    await page.keyboard.press('Control+End');
    await page.getByRole('button', { name: 'Insert clause' }).click();
    await page.getByRole('menuitem', { name: /Liability clause/ }).click();
    await expect(body).toHaveValue(/These terms apply to all contracts\.\n\n## Liability\n\nWe are liable/);
    await settle(page);

    // the preview shows title and rendered Markdown, no table
    // (the pages are iframes; the first holds the document)
    const pages = page.getByRole('complementary', { name: 'Preview' }).locator('iframe');
    await expect(async () => {
        const html = await pages.evaluateAll((frames) => frames.map((frame) => (frame as HTMLIFrameElement).srcdoc).join('\n'));
        expect(html).toContain('<h1>General terms and conditions</h1>');
        expect(html).toContain('<h2>Liability</h2>');
        expect(html).not.toContain('<table');
    }).toPass();

    // public with a customer is only a hint, public without the short name a field error
    await page.getByLabel('Short name').fill('');
    await page.getByRole('switch').check();
    await expect(page.getByText('A public text needs a short name.')).toBeVisible();
    await page.getByRole('switch').uncheck();
    await page.getByLabel('Short name').fill('terms-e2e');
    await settle(page);
    await expect(page.getByText('Ready to finalize')).toBeVisible();

    await finalize(page, 'Text document');
    await expect(heading(page)).toHaveAccessibleName(/^Text document T-\d{4}-\d{4}$/);

    // a new version: duplicate, same text
    await page.getByRole('button', { name: 'More actions' }).click();
    await page.getByRole('menuitem', { name: 'Duplicate' }).click();
    await expect(page).toHaveURL(/\/en\/documents\/[0-9a-z]{26}$/);
    await expect(heading(page)).toHaveAccessibleName('Text document (draft)');
    await expect(page.getByLabel('Title', { exact: true })).toHaveValue('General terms and conditions');
    await expect(page.getByRole('textbox', { name: /^Text/ })).toHaveValue(/## Liability/);
    await expect(page.getByLabel('Short name')).toHaveValue('terms-e2e');
});
