import { expect, test } from '@playwright/test';
import { settle } from './editor-helpers';
import { apiDelete, apiGet, apiPatch, apiPost, pdfText } from './helpers';

/**
 * Success criterion of the spec: custom field → filled in a document → used in a template → visible in the preview
 * and in the PDF. Runs against the demo data; the field gets a unique label so reruns without reseeding work.
 */
test('custom field from definition to preview and PDF', async ({ page }) => {
    test.setTimeout(120_000);
    const suffix = Date.now().toString(36);
    const label = `Project code ${suffix}`;
    const key = `project_code_${suffix}`;
    const value = `NORDLICHT-${suffix.toUpperCase()}`;

    // 1. define the field (document level, all types)
    await page.goto('/en/fields?scope=document');
    await page.getByRole('button', { name: 'Add field' }).click();
    const drawer = page.getByRole('dialog', { name: 'Add field' });
    await drawer.getByLabel('Label').fill(label);
    await expect(drawer.getByLabel('Key')).toHaveValue(key);
    await drawer.getByRole('button', { name: 'Create field' }).click();
    await expect(page.getByText(`Field “${label}” created`)).toBeVisible();

    // 2. fill it in a new invoice draft
    const [customer] = (await apiGet(page, '/api/customers?q=Hafenkontor')) as { id: string }[];
    const draft = (await apiPost(page, '/api/documents', { type: 'invoice', customer_id: customer.id })) as { id: string };
    await page.goto(`/en/documents/${draft.id}`);
    await page.getByLabel(label).fill(value);
    await settle(page);

    // 3. use it in a copy of Klar through the field bar
    await page.goto('/en/templates');
    const klar = page.getByRole('article').filter({ has: page.getByRole('heading', { name: 'Klar', exact: true }) });
    await klar.getByRole('button', { name: 'Duplicate' }).click();
    await page.getByRole('button', { name: 'Edit' }).last().click(); // toast action
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(/Klar \(copy\)/);
    const templateId = page.url().split('/').pop()!;
    await page.getByRole('tab', { name: 'Content' }).click();
    await page.locator('.cm-content').click();
    await page.keyboard.press('ControlOrMeta+End');
    await page.keyboard.press('Enter');
    await page.getByRole('region', { name: 'Available fields' }).getByRole('button', { name: new RegExp(label) }).click();
    await expect(page.locator('.cm-content')).toContainText(`{{ document.${key} }}`);

    // 4. preview with the draft as sample data
    await page.getByLabel('Sample data').selectOption(`document:${draft.id}`);
    await expect(page.frameLocator('.pp-clip iframe').first().getByText(value)).toBeVisible({ timeout: 15_000 });
    await page.keyboard.press('ControlOrMeta+s');
    await expect(page.getByText('Template saved')).toBeVisible();

    try {
        // 5. give the draft the copy as its template (a draft keeps the template of its type from when it was
        // created), then the document preview and the PDF show the value
        await apiPatch(page, `/api/documents/${draft.id}`, { template_id: templateId });
        await page.goto(`/en/documents/${draft.id}`);
        await expect(page.frameLocator('.pp-clip iframe').first().getByText(value)).toBeVisible({ timeout: 15_000 });
        expect(await pdfText(page, `/api/documents/${draft.id}/pdf`)).toContain(value);
    } finally {
        // leave the demo data as it was: later specs count documents and fields
        await apiDelete(page, `/api/documents/${draft.id}`);
        await apiDelete(page, `/api/templates/${templateId}`);
        const fields = (await apiGet(page, '/api/field-definitions?scope=document')) as { id: string; key: string }[];
        const field = fields.find((f) => f.key === key);
        if (field) await apiDelete(page, `/api/field-definitions/${field.id}`);
    }
});
