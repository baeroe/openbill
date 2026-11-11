import { expect, test } from '@playwright/test';
import { fillRow, newDocument, settle } from './editor-helpers';
import { apiDelete, apiGet } from './helpers';

type Position = { discount_type: 'percent' | 'amount' | null; discount_value: string | null };
type Doc = { net_total: string; groups: { positions: Position[] }[]; issues: { code: string }[] };

test('discount per position: percent, amount, too large, removed', async ({ page }) => {
    await page.goto('/en'); // signed in through the setup project (storageState)
    const id = await newDocument(page, 'Invoice', /Hafenkontor Lindqvist/);
    const loose = page.getByRole('group', { name: 'Loose positions' });
    await loose.getByRole('button', { name: 'Add position' }).click();
    const row = loose.locator('[data-position-row]').first();
    await fillRow(loose, 0, 'Workshop', '2', '85');
    await settle(page);

    // the position menu adds a discount (percent first) and puts the cursor into its value
    await row.getByRole('button', { name: 'Edit position' }).click();
    await page.getByRole('menuitem', { name: 'Add discount' }).click();
    const value = row.getByRole('textbox', { name: 'Discount', exact: true });
    await expect(value).toBeFocused();
    await value.fill('10');
    await value.press('Tab');
    await settle(page);

    // the server computes the line: 2 × 85 = 170, 10 % off = 153
    await expect(row.getByLabel('Total of the position')).toHaveText('€153.00');
    await expect(row).toContainText('of €170.00');
    const totals = page.getByRole('group', { name: 'Totals' });
    await expect(totals).toContainText('€182.07');
    let doc = (await apiGet(page, `/api/documents/${id}`)) as Doc;
    expect(doc.groups[0].positions[0]).toMatchObject({ discount_type: 'percent', discount_value: '10.00' });
    expect(doc.net_total).toBe('153.00');

    // a fixed amount larger than the line is an issue, not a save error
    await row.getByRole('combobox', { name: 'Discount in percent or euros' }).selectOption('amount');
    await value.fill('200');
    await value.press('Tab');
    await settle(page);
    const check = page.locator('#check-panel');
    await expect(check).toContainText('“Workshop”: the discount is larger than the line amount.');
    doc = (await apiGet(page, `/api/documents/${id}`)) as Doc;
    expect(doc.issues.map((issue) => issue.code)).toContain('discount_exceeds_line');

    await value.fill('20');
    await value.press('Tab');
    await settle(page);
    await expect(row.getByLabel('Total of the position')).toHaveText('€150.00');
    await expect(check).not.toContainText('larger than the line amount');
    doc = (await apiGet(page, `/api/documents/${id}`)) as Doc;
    expect(doc.groups[0].positions[0]).toMatchObject({ discount_type: 'amount', discount_value: '20.00' });

    // the preview shows the discount at the position (the customer's documents are German, template Klar)
    await expect(page.frameLocator('.pp-clip iframe').first().getByText('Rabatt −20,00 €')).toBeVisible();

    // removing it brings back the full line amount
    await row.getByRole('button', { name: 'Remove discount' }).click();
    await settle(page);
    await expect(row.getByLabel('Total of the position')).toHaveText('€170.00');
    await expect(value).toBeHidden();
    doc = (await apiGet(page, `/api/documents/${id}`)) as Doc;
    expect(doc.groups[0].positions[0]).toMatchObject({ discount_type: null, discount_value: null });

    // the document list specs count the demo invoices: leave none behind
    await apiDelete(page, `/api/documents/${id}`);
});
