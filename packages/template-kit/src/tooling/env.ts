import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { parseEnv } from 'node:util';

export type KitEnv = { url: string; token: string; templateId: string };

export const ENV_FILE = '.env.local';

const KEYS = { url: 'OPENBILL_URL', token: 'OPENBILL_TOKEN', templateId: 'OPENBILL_TEMPLATE_ID' } as const;

export class KitConfigError extends Error {
    constructor(readonly problems: string[]) {
        super(`${ENV_FILE}: ${problems.join(' ')}`);
        this.name = 'KitConfigError';
    }
}

/** Instance URL, token and template id from .env.local (written by the toolkit download); OPENBILL_* variables of the environment win. */
export function readKitEnv(root: string, environment: Record<string, string | undefined> = process.env): KitEnv {
    const file = path.join(root, ENV_FILE);
    const fromFile = existsSync(file) ? parseEnv(readFileSync(file, 'utf8')) : {};
    const value = (key: string): string => (environment[key] ?? fromFile[key] ?? '').trim();

    const problems: string[] = [];
    const missing = Object.values(KEYS).filter((key) => value(key) === '');
    if (missing.length > 0) {
        problems.push(`Missing ${missing.join(', ')} (download the toolkit again in the template editor, or set them in ${ENV_FILE}).`);
    }
    const url = value(KEYS.url).replace(/\/+$/, '');
    if (url !== '' && !/^https?:\/\/[^/\s]+/.test(url)) {
        problems.push(`${KEYS.url} must start with http:// or https:// (got "${url}").`);
    }
    if (problems.length > 0) throw new KitConfigError(problems);

    return { url, token: value(KEYS.token), templateId: value(KEYS.templateId) };
}
