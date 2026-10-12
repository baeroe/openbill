import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const here = path.resolve(import.meta.dirname, '..');
const read = (file: string) => readFileSync(path.join(here, file), 'utf8');
const kit = JSON.parse(read('kit-files/package.json')) as { scripts: Record<string, string>; devDependencies: Record<string, string>; dependencies?: unknown; engines: { node: string }; packageManager: string };
const workspace = JSON.parse(read('package.json')) as { devDependencies: Record<string, string> };

describe('the kit the user unpacks', () => {
    it('runs only vite and node tooling/cli.js – no npm, no npx', () => {
        expect(kit.scripts).toEqual({ dev: 'vite', push: 'node tooling/cli.js push', pull: 'node tooling/cli.js pull', pack: 'node tooling/cli.js pack' });
    });

    it('installs only vite, in the version of the workspace, and needs Node 24 and pnpm', () => {
        expect(kit.dependencies).toBeUndefined();
        expect(kit.devDependencies).toEqual({ vite: workspace.devDependencies.vite });
        expect(kit.engines.node).toBe('>=24');
        expect(kit.packageManager).toMatch(/^pnpm@\d+\.\d+\.\d+$/);
    });

    it('is its own pnpm project that refuses old Node versions', () => {
        const yaml = read('kit-files/pnpm-workspace.yaml');
        expect(yaml).toContain('packages: []');
        expect(yaml).toContain('engineStrict: true');
    });

    it('explains every command and the token in the README', () => {
        const readme = read('kit-files/README.md');
        for (const text of ['pnpm install', 'pnpm dev', 'pnpm push', 'pnpm pull', 'pnpm run pack', '.env.local', '--use-system-ca']) expect(readme).toContain(text);
    });

    it('tells coding agents what to edit, how to check a render and the Liquid rules that bite', () => {
        const agents = read('kit-files/AGENTS.md');
        for (const text of ['template/template.liquid', 'pnpm dev', 'pnpm push', 'pnpm pull', 'pnpm run pack', '/__openbill/state', '!= blank', '> 0', 'money', 'nl2br', '.env.local']) expect(agents).toContain(text);
        expect(read('kit-files/README.md')).toContain('AGENTS.md');
    });
});
