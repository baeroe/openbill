import { test as setup } from '@playwright/test';
import { AUTH_FILE, login } from './helpers';

// One login for the whole run (the login is throttled to 20 attempts a minute per IP): every test except the login
// tests starts with this session (playwright.config.ts, project "chromium").
setup('sign in', async ({ page }) => {
    await login(page);
    await page.context().storageState({ path: AUTH_FILE });
});
