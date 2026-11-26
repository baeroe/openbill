import { expect, test } from '@playwright/test';
import { fillRow, finalize, heading, newDocument, settle } from './editor-helpers';
import { apiGet, apiPost, pdfText } from './helpers';

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

test('a public text is readable without login under its link', async ({ page, browser, baseURL }) => {
    await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.goto('/en/documents');
    const slug = `public-e2e-${Date.now().toString(36)}`;
    const created = (await apiPost(page, '/api/documents', { type: 'text', title: 'Public terms', body: '## Public\n\nReadable by anyone.', slug, is_public: true })) as { id: string };
    await apiPost(page, `/api/documents/${created.id}/finalize`);

    await page.goto(`/en/documents/${created.id}`);
    await expect(heading(page)).toHaveAccessibleName(/^Text document T-\d{4}-\d{4}$/);
    const latest = page.getByLabel('Link to the newest version');
    await expect(latest).toHaveValue(new RegExp(`/legal/${slug}$`));
    await expect(page.getByLabel('Link to this version')).toHaveValue(new RegExp(`/legal/${slug}/T-\\d{4}-\\d{4}$`));

    // copy puts the link on the clipboard
    await page.getByRole('button', { name: 'Copy link' }).first().click();
    await expect(page.getByText('Link copied')).toBeVisible();
    const link = await page.evaluate(() => navigator.clipboard.readText());
    expect(link).toBe(await page.getByLabel('Link to this version').inputValue());

    // signed out: a context without the session still gets the PDF, at both links
    const visitor = await browser.newContext({ baseURL, ignoreHTTPSErrors: true, storageState: { cookies: [], origins: [] } });
    try {
        for (const url of [`/legal/${slug}`, new URL(link).pathname]) {
            const response = await visitor.request.get(url);
            expect(response.status(), url).toBe(200);
            expect(response.headers()['content-type']).toBe('application/pdf');
            expect(response.headers()['content-disposition']).toContain('inline');
            const { extractText, getDocumentProxy } = await import('unpdf');
            const { text } = await extractText(await getDocumentProxy(new Uint8Array(await response.body())), { mergePages: true });
            expect(text).toContain('Readable by anyone.');
        }
        expect((await visitor.request.get('/legal/does-not-exist')).status()).toBe(404);
    } finally {
        await visitor.close();
    }
});

test('a quote names its attachment with number and link, frozen when finalized; the attachment is a PDF of its own', async ({ page }) => {
    test.setTimeout(120_000);
    await page.goto('/en/documents');
    const slug = `agb-e2e-${Date.now().toString(36)}`;
    const text = (await apiPost(page, '/api/documents', { type: 'text', title: 'Terms E2E', body: 'First version', slug, is_public: true })) as { id: string };
    const first = (await apiPost(page, `/api/documents/${text.id}/finalize`)) as { number: string };

    // the quote: one position, the attachment from the list
    await newDocument(page, 'Quote', /Hotel Alpenglück/);
    const quoteId = page.url().split('/').pop()!;
    await page.getByRole('button', { name: 'Add position' }).first().click();
    await fillRow(page.locator('.ed-main'), 0, 'Consulting', '1', '100');
    await page.getByLabel('Add attachment').selectOption({ value: slug });
    await expect(page.getByRole('button', { name: `Remove attachment ${slug}` })).toBeVisible();
    await settle(page);
    await finalize(page, 'Quote');

    // frozen: the quote lists the version of that moment, its PDF text names number and link
    await expect(page.getByText(`${slug} · ${first.number}`)).toBeVisible();
    const pdf = await pdfText(page, `/api/documents/${quoteId}/pdf`);
    expect(pdf).toContain('Anlagen'); // the customer's language
    expect(pdf).toContain(`Terms E2E (${first.number})`);
    expect(pdf).toContain(`/legal/${slug}/${first.number}`);

    // a newer version of the text changes nothing about the quote
    const copy = (await apiPost(page, `/api/documents/${text.id}/duplicate`)) as { id: string };
    await apiPost(page, `/api/documents/${copy.id}/finalize`);
    await page.reload();
    await expect(page.getByText(`${slug} · ${first.number}`)).toBeVisible();
    const frozen = (await apiGet(page, `/api/documents/${quoteId}`)) as { attachments: { document_id: string; number: string }[] };
    expect(frozen.attachments.map((item) => item.number)).toEqual([first.number]);

    // the attachment downloads as a PDF of its own
    const download = page.waitForEvent('download');
    await page.getByRole('link', { name: 'Download PDF' }).click();
    expect((await download).suggestedFilename()).toBe(`${first.number}.pdf`);
    expect(await pdfText(page, `/api/documents/${frozen.attachments[0].document_id}/pdf`)).toContain('First version');
});
