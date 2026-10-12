import { describe, expect, it } from 'vitest';
import { setupSnippet, TOKEN_PLACEHOLDER } from './mcp-setup';

const MCP_URL = 'https://openbill.example/mcp';
const TOKEN = '01k9x2m3n4p5q6r7s8t9v0w1y2|openbill_abc123';

describe('setupSnippet', () => {
    it('builds the Claude Code command with URL and token', () => {
        expect(setupSnippet('claude', MCP_URL, TOKEN)).toBe(
            `claude mcp add --transport http --scope user openbill https://openbill.example/mcp --header "Authorization: Bearer ${TOKEN}"`,
        );
    });

    it('builds the Codex config block', () => {
        expect(setupSnippet('codex', MCP_URL, TOKEN)).toBe(
            `[mcp_servers.openbill]\nurl = "https://openbill.example/mcp"\nhttp_headers = { "Authorization" = "Bearer ${TOKEN}" }`,
        );
    });

    it('builds the JSON configuration', () => {
        expect(JSON.parse(setupSnippet('json', MCP_URL, TOKEN))).toEqual({
            mcpServers: { openbill: { type: 'http', url: MCP_URL, headers: { Authorization: `Bearer ${TOKEN}` } } },
        });
    });

    it('puts a placeholder where no token is known', () => {
        expect(setupSnippet('claude', MCP_URL)).toContain(`"Authorization: Bearer ${TOKEN_PLACEHOLDER}"`);
        expect(TOKEN_PLACEHOLDER).toBe('<token>');
    });
});
