import { expect, test } from '@playwright/test';
import { finalize, fillRow, heading, newDocument, settle, today } from './editor-helpers';
import { apiGet, login } from './helpers';

type Doc = { gross_total: string; net_total: string; status: string; number: string | null; groups: { title: string | null }[] };

test('quote with groups → finalize → accepted → invoice → check green → finalize → PDF → paid → cancellation', async ({ page }) => {
    test.setTimeout(180_000);
    await login(page);

    // 1. quote for Hafenkontor Lindqvist with two groups
    const quoteId = await newDocument(page, 'Quote', /Hafenkontor Lindqvist/);
    await expect(heading(page)).toHaveAccessibleName('Quote (draft)');

    await page.getByRole('button', { name: 'Add group' }).click();
    await expect(page.getByRole('textbox', { name: 'Group name' }).last()).toBeFocused();
    await page.keyboard.type('Konzept');
    const konzept = page.getByRole('group', { name: 'Konzept' });
    await fillRow(konzept, 0, 'Workshop', '2', '450');
    await konzept.getByRole('button', { name: 'Add position' }).click();
    await fillRow(konzept, 1, 'Konzeptpapier', '1', '800');

    await page.getByRole('button', { name: 'Add group' }).click();
    await expect(page.getByRole('textbox', { name: 'Group name' }).last()).toBeFocused();
    await page.keyboard.type('Umsetzung');
    await fillRow(page.getByRole('group', { name: 'Umsetzung' }), 0, 'Umsetzung Website', '1', '3200');
    await settle(page);

    // totals come from the server: 2 × 450 + 800 + 3200 = 4900 net, 19 % VAT
    const totals = page.getByRole('group', { name: 'Totals' });
    await expect(totals).toContainText('€4,900.00');
    await expect(totals).toContainText('€5,831.00');
    expect(((await apiGet(page, `/api/documents/${quoteId}`)) as Doc).gross_total).toBe('5831.00');

    // 2. move "Umsetzung" above "Konzept" with the keyboard (dnd-kit: Space, arrow, Space)
    await page.getByRole('button', { name: 'Move group “Umsetzung”' }).focus();
    // dnd-kit needs a frame between the keys
    await page.keyboard.press('Space');
    await page.waitForTimeout(150);
    await page.keyboard.press('ArrowUp');
    await page.waitForTimeout(150);
    await page.keyboard.press('Space');
    await settle(page);
    expect(((await apiGet(page, `/api/documents/${quoteId}`)) as Doc).groups.map((g) => g.title)).toEqual([null, 'Umsetzung', 'Konzept']);

    // 3. finalize the quote: number from the server, read-only afterwards
    await page.getByRole('button', { name: 'Finalize', exact: true }).click();
    const confirm = page.getByRole('dialog', { name: 'Finalize Quote?' });
    await expect(confirm).toContainText(/AN-\d{4}-\d{4}/);
    await confirm.getByRole('button', { name: 'Finalize' }).click();
    await expect(heading(page)).toHaveAccessibleName(/^Quote AN-\d{4}-\d{4}$/);
    await expect(page.getByText(/Finalized on/)).toBeVisible();
    await expect(page.getByRole('combobox', { name: 'Item' }).first()).toBeDisabled();

    // 4. accepted, then convert into an invoice
    await page.getByRole('button', { name: 'Change status' }).click();
    await page.getByRole('menuitem', { name: 'Mark as accepted' }).click();
    await expect(page.locator('.ed-head').getByText('Accepted', { exact: true })).toBeVisible();

    await page.getByRole('button', { name: 'Convert' }).click();
    await page.getByRole('menuitem', { name: 'To Invoice' }).click();
    await expect(heading(page)).toHaveAccessibleName('Invoice (draft)');
    const invoiceId = page.url().split('/').pop()!;
    expect(invoiceId).not.toBe(quoteId);
    await expect(page.getByRole('navigation', { name: 'Document chain' }).getByRole('link')).toHaveCount(2);

    // 5. make the check green: an empty service date is an issue, the issue jumps to the field
    const check = page.locator('#check-panel');
    const serviceDate = page.getByLabel('Service from');
    await serviceDate.fill('');
    await expect(check).toContainText('Service date is missing.');
    await check.getByRole('button', { name: /Service date is missing/ }).click();
    await expect(serviceDate).toBeFocused();
    await serviceDate.fill(today());
    await expect(check).toContainText('Ready to finalize');
    await settle(page);

    // 6. finalize the invoice (PDF/A-3 with XML in the archive), open the PDF, look at the e-invoice
    await finalize(page, 'Invoice');
    await expect(heading(page)).toHaveAccessibleName(/^Invoice RE-\d{4}-\d{4}$/);

    const popup = page.context().waitForEvent('page');
    // headless Chromium downloads a PDF in a new tab instead of showing it: check the request of the tab
    const pdfRequest = page.context().waitForEvent('request', (request) => request.url().includes(`/api/documents/${invoiceId}/pdf`));
    await page.getByRole('button', { name: 'More actions' }).click();
    await page.getByRole('menuitem', { name: 'Download PDF' }).click();
    const pdfPage = await popup;
    expect((await pdfRequest).frame().page()).toBe(pdfPage);
    await pdfPage.close();
    const pdf = await page.request.get(`/api/documents/${invoiceId}/pdf`, { headers: { Referer: page.url() } });
    expect(pdf.headers()['content-type']).toContain('application/pdf');

    await page.getByRole('tab', { name: 'E-invoice' }).click();
    await expect(page.locator('pre')).toContainText('CrossIndustryInvoice');
    await page.getByRole('tab', { name: 'Preview' }).click();

    // 7. paid
    await page.getByRole('button', { name: 'Change status' }).click();
    await page.getByRole('menuitem', { name: 'Mark as paid' }).click();
    await expect(page.locator('.ed-head').getByText('Paid', { exact: true })).toBeVisible();

    // 8. cancellation: draft from the invoice, finalize, the invoice becomes cancelled
    await page.getByRole('button', { name: 'More actions' }).click();
    await page.getByRole('menuitem', { name: 'Cancel invoice' }).click();
    await page.getByRole('dialog', { name: /^Cancel RE-/ }).getByRole('button', { name: 'Create cancellation' }).click();
    await expect(heading(page)).toHaveAccessibleName('Cancellation (draft)');
    await expect(page.locator('#check-panel')).toContainText('Ready to finalize');
    await finalize(page, 'Cancellation');
    await expect(heading(page)).toHaveAccessibleName(/^Cancellation ST-\d{4}-\d{4}$/);

    const chain = page.getByRole('navigation', { name: 'Document chain' });
    await expect(chain.getByRole('link')).toHaveCount(3);
    await chain.getByRole('link', { name: /Invoice RE-/ }).click();
    await expect(page.locator('.ed-head').getByText('Cancelled', { exact: true })).toBeVisible();
    await expect(page.getByText(/Cancelled by/)).toBeVisible();
    expect(((await apiGet(page, `/api/documents/${invoiceId}`)) as Doc).status).toBe('cancelled');
});
