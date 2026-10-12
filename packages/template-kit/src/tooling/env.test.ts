import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { KitConfigError, readKitEnv } from './env';

function kit(env?: string): string {
    const dir = mkdtempSync(path.join(tmpdir(), 'kit-env-'));
    if (env !== undefined) writeFileSync(path.join(dir, '.env.local'), env);
    return dir;
}

describe('readKitEnv', () => {
    it('reads .env.local with quoted values (the token contains "|") and drops a trailing slash', () => {
        const dir = kit('# keep private\nOPENBILL_URL="https://openbill.example/"\nOPENBILL_TOKEN="3|openbill_abc"\nOPENBILL_TEMPLATE_ID="01kfjordbrief"\n');

        expect(readKitEnv(dir, {})).toEqual({ url: 'https://openbill.example', token: '3|openbill_abc', templateId: '01kfjordbrief' });
    });

    it('lets OPENBILL_* variables of the environment win over the file', () => {
        const dir = kit('OPENBILL_URL="https://openbill.example"\nOPENBILL_TOKEN="3|old"\nOPENBILL_TEMPLATE_ID="01kfjordbrief"\n');

        expect(readKitEnv(dir, { OPENBILL_TOKEN: '4|new' }).token).toBe('4|new');
    });

    it('names every missing key', () => {
        expect(() => readKitEnv(kit(), {})).toThrow(/Missing OPENBILL_URL, OPENBILL_TOKEN, OPENBILL_TEMPLATE_ID/);
    });

    it('refuses a URL without http(s)', () => {
        const dir = kit('OPENBILL_URL="openbill.example"\nOPENBILL_TOKEN="3|x"\nOPENBILL_TEMPLATE_ID="01k"\n');

        expect(() => readKitEnv(dir, {})).toThrow(KitConfigError);
        expect(() => readKitEnv(dir, {})).toThrow(/must start with http/);
    });

    it.each(['http://openbill.example', 'http://192.168.1.20:8080', 'http://openbill.localhost'])('refuses plain http for %s: the token would travel unencrypted', (url) => {
        const dir = kit(`OPENBILL_URL="${url}"\nOPENBILL_TOKEN="3|x"\nOPENBILL_TEMPLATE_ID="01k"\n`);

        expect(() => readKitEnv(dir, {})).toThrow(/OPENBILL_URL must use https:\/\//);
    });

    it.each(['http://localhost:8000', 'http://127.0.0.1:8000', 'http://[::1]:8000', 'https://openbill.example'])('accepts %s', (url) => {
        const dir = kit(`OPENBILL_URL="${url}"\nOPENBILL_TOKEN="3|x"\nOPENBILL_TEMPLATE_ID="01k"\n`);

        expect(readKitEnv(dir, {}).url).toBe(url);
    });
});
