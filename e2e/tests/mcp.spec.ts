import { expect, request, test } from '@playwright/test';

test('API & MCP: create a token, call the MCP server with it, revoke it', async ({ page, baseURL }) => {
    await page.goto('/en/settings/api');
    await expect(page.getByRole('heading', { name: 'Connect an agent' })).toBeVisible();

    await page.getByRole('button', { name: 'New token' }).click();
    const form = page.getByRole('dialog', { name: 'New token' });
    await form.getByLabel('Name').fill('Playwright agent');
    await expect(form.getByRole('checkbox', { name: /^MCP/ })).toBeChecked();
    await form.getByRole('button', { name: 'Create token' }).click();

    const created = page.getByRole('dialog', { name: 'Token created' });
    const token = await created.getByLabel('Token', { exact: true }).inputValue();
    expect(token).toContain('|openbill_');
    await expect(created.locator('pre')).toContainText(`claude mcp add --transport http --scope user openbill ${baseURL}/mcp`);
    await expect(created.locator('pre')).toContainText(token);
    await created.getByRole('tab', { name: 'Codex' }).click();
    await expect(created.locator('pre')).toContainText('[mcp_servers.openbill]');
    await created.getByRole('button', { name: 'Close' }).last().click();

    // a fresh client without the session cookie: only the token counts
    const mcp = await request.newContext({ baseURL, ignoreHTTPSErrors: true });
    const call = (method: string, params: object = {}) =>
        mcp.post('/mcp', {
            headers: { Authorization: `Bearer ${token}`, Accept: 'application/json, text/event-stream' },
            data: { jsonrpc: '2.0', id: 1, method, params },
        });

    const list = await call('tools/list');
    expect(list.status()).toBe(200);
    const names = ((await list.json()).result.tools as { name: string }[]).map((tool) => tool.name);
    expect(names).toHaveLength(25);
    expect(names).toContain('list-documents');

    const documents = await call('tools/call', { name: 'list-documents', arguments: { per_page: 5 } });
    const result = (await documents.json()).result as { isError: boolean; content: { text: string }[] };
    expect(result.isError).toBe(false);
    expect((JSON.parse(result.content[0].text) as { items: unknown[] }).items.length).toBeGreaterThan(0);

    // "last used" shows up, then revoke: the next call is refused
    await page.reload();
    const row = page.getByRole('listitem').filter({ hasText: 'Playwright agent' });
    await expect(row.getByText(/last used/)).toBeVisible();
    await row.getByRole('button', { name: 'Revoke Playwright agent' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Revoke', exact: true }).click();
    await expect(page.getByText('Token “Playwright agent” revoked')).toBeVisible();
    expect((await call('tools/list')).status()).toBe(401);

    await mcp.dispose();
});
