export type SetupClient = 'claude' | 'codex' | 'json';

export const SETUP_CLIENTS: SetupClient[] = ['claude', 'codex', 'json'];

/** Stands in for the token in the snippets of the page; the dialog after "New token" fills in the real one. */
export const TOKEN_PLACEHOLDER = '<token>';

/** Setup snippet of the MCP server for an agent, with URL and token filled in. */
export function setupSnippet(client: SetupClient, url: string, token: string = TOKEN_PLACEHOLDER): string {
    const authorization = `Bearer ${token}`;
    switch (client) {
        case 'claude':
            return `claude mcp add --transport http --scope user openbill ${url} --header "Authorization: ${authorization}"`;
        case 'codex':
            return `[mcp_servers.openbill]\nurl = "${url}"\nhttp_headers = { "Authorization" = "${authorization}" }`;
        case 'json':
            return JSON.stringify({ mcpServers: { openbill: { type: 'http', url, headers: { Authorization: authorization } } } }, null, 2);
    }
}
