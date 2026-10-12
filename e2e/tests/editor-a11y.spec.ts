import { expect, test, type Page } from '@playwright/test';
import { heading, newDocument, settle } from './editor-helpers';
import { apiGet, apiPatch } from './helpers';

type Doc = { groups: { title: string | null; positions: { title: string }[] }[] };

const item = (title: string) => ({ id: `local-${title}`, kind: 'item', title, description: '', quantity: '1', unit_id: null, unit_price: '100', tax_rate_id: null, custom: {} });

/** A quote with the groups "Konzept" (Workshop, Konzeptpapier) and "Umsetzung" (Website), opened in the editor. */
async function quoteWithGroups(page: Page, locale: 'en' | 'de' = 'en'): Promise<string> {
    const id = await newDocument(page, 'Quote', /Hafenkontor Lindqvist/);
    await apiPatch(page, `/api/documents/${id}`, {
        groups: [
            { id: 'local-g1', title: 'Konzept', positions: [item('Workshop'), item('Konzeptpapier')] },
            { id: 'local-g2', title: 'Umsetzung', positions: [item('Website')] },
        ],
    });
    await page.goto(`/${locale}/documents/${id}`);
    await expect(page.locator('[data-position-row]')).toHaveCount(3);
    return id;
}

const titles = async (page: Page, id: string) => ((await apiGet(page, `/api/documents/${id}`)) as Doc).groups.map((g) => `${g.title}:${g.positions.map((p) => p.title).join(',')}`);

test('announces keyboard drag and drop in the UI language, with titles instead of ids (review 3)', async ({ page }) => {
    await quoteWithGroups(page, 'de');
    // every text the live region of dnd-kit speaks, in order (a later one replaces the earlier text right away)
    await page.evaluate(() => {
        const spoken: string[] = [];
        (window as unknown as { spoken: string[] }).spoken = spoken;
        new MutationObserver(() => {
            const text = document.querySelector('[id^="DndLiveRegion"]')?.textContent ?? '';
            if (text && spoken.at(-1) !== text) spoken.push(text);
        }).observe(document.body, { subtree: true, childList: true, characterData: true });
    });
    const spoken = () => page.evaluate(() => (window as unknown as { spoken: string[] }).spoken);

    await expect(page.locator('[id^="DndDescribedBy"]').first()).toContainText('Leertaste');
    await page.getByRole('button', { name: 'Gruppe „Umsetzung“ verschieben' }).focus();
    await page.keyboard.press('Space');
    await expect.poll(spoken).toEqual(['„Umsetzung“ aufgenommen.']);
    await page.waitForTimeout(150); // dnd-kit attaches its key listener a frame after the pick-up
    await page.keyboard.press('ArrowUp');
    await expect.poll(spoken).toContain('Gruppe „Umsetzung“ ist auf Platz 1 von 2.');
    await page.keyboard.press('Escape');
    await expect.poll(spoken).toContain('Verschieben von „Umsetzung“ abgebrochen, es ist wieder an seinem Platz.');
    expect((await spoken()).join(' ')).not.toMatch(/group:|pos:|Draggable|droppable/);
});

test('Escape puts a position dragged into another group back (review 4)', async ({ page }) => {
    const id = await quoteWithGroups(page);
    const before = await titles(page, id);

    await page.getByRole('button', { name: 'Move “Website”' }).focus();
    await page.keyboard.press('Space');
    await page.waitForTimeout(150);
    // first over the body of its own group, then into "Konzept"
    for (let i = 0; i < 2; i++) {
        await page.keyboard.press('ArrowUp');
        await page.waitForTimeout(200);
    }
    await expect(page.getByRole('group', { name: 'Konzept' }).locator('[data-position-row]')).toHaveCount(3);
    await page.keyboard.press('Escape');

    await expect(page.getByRole('group', { name: 'Umsetzung' }).locator('[data-position-row]')).toHaveCount(1);
    await settle(page);
    expect(await titles(page, id)).toEqual(before);
});

test('keeps the keyboard focus in the list after removing a position or a group, and on undo (review 5)', async ({ page }) => {
    await quoteWithGroups(page);
    const konzept = page.getByRole('group', { name: 'Konzept' });
    const title = (scope: ReturnType<Page['getByRole']>, n: number) => scope.locator('[data-position-row]').nth(n).getByRole('combobox', { name: 'Item' });

    // position: the next row takes the focus
    await konzept.locator('[data-position-row]').nth(0).getByRole('button', { name: 'Edit position' }).press('Enter');
    await page.getByRole('menuitem', { name: 'Remove position' }).press('Enter');
    await expect(konzept.locator('[data-position-row]')).toHaveCount(1);
    await expect(title(konzept, 0)).toHaveValue('Konzeptpapier');
    await expect(title(konzept, 0)).toBeFocused();

    // undo: the restored row takes the focus
    await page.getByRole('button', { name: 'Undo' }).click();
    await expect(konzept.locator('[data-position-row]')).toHaveCount(2);
    await expect(title(konzept, 0)).toHaveValue('Workshop');
    await expect(title(konzept, 0)).toBeFocused();

    // group: the name of the next group takes the focus
    await konzept.getByRole('button', { name: 'Edit group' }).press('Enter');
    await page.getByRole('menuitem', { name: 'Remove group with positions' }).press('Enter');
    await expect(page.getByRole('group', { name: 'Konzept' })).toHaveCount(0);
    await expect(page.getByRole('group', { name: 'Umsetzung' }).getByRole('textbox', { name: 'Group name' })).toBeFocused();
    await expect(heading(page)).toHaveAccessibleName('Quote (draft)');
});
