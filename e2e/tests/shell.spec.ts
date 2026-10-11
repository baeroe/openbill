import { expect, test } from '@playwright/test';
import { login } from './helpers';

test.describe('on a phone', () => {
    test.use({ viewport: { width: 390, height: 844 } });

    test('opens the navigation as a modal dialog that keeps the focus (review focus)', async ({ page }) => {
        await login(page);
        const opener = page.getByRole('button', { name: 'Open navigation' });
        await opener.click();

        const navigation = page.getByRole('dialog', { name: 'Sidebar' });
        await expect(navigation).toBeVisible();
        await expect(navigation).toHaveAttribute('aria-modal', 'true');
        // the rest of the page is aria-hidden while the dialog is open, so the opener is found by CSS here
        await expect(page.locator('button[aria-haspopup="dialog"]', { hasText: 'Open navigation' })).toHaveAttribute('aria-expanded', 'true');

        for (let i = 0; i < 12; i++) {
            await page.keyboard.press('Tab');
            expect(await navigation.evaluate((element) => element.contains(document.activeElement))).toBe(true);
        }

        await page.keyboard.press('Escape');
        await expect(navigation).toBeHidden();
        await expect(opener).toBeFocused();
    });

    test('closes the navigation after choosing a page', async ({ page }) => {
        await login(page);
        await page.getByRole('button', { name: 'Open navigation' }).click();
        await page.getByRole('dialog', { name: 'Sidebar' }).getByRole('link', { name: 'Customers' }).click();

        await expect(page).toHaveURL(/\/en\/customers$/);
        await expect(page.getByRole('dialog')).toBeHidden();
    });
});
