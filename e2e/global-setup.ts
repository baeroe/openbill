import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');

/** Fresh demo data and the e2e login in the DDEV database (PHP runs only in DDEV). E2E_SKIP_SEED=1 skips it. */
export default function globalSetup(): void {
    if (!existsSync(path.join(root, 'public/hot')) && !existsSync(path.join(root, 'public/build/manifest.json'))) {
        throw new Error('No frontend assets: run `ddev exec pnpm build` (or keep `ddev exec pnpm dev` running) first.');
    }
    // the toolkit download (toolkit.spec.ts) packs packages/template-kit/dist/kit; against Compose (phase 10) it lives in the image
    if (!process.env.OPENBILL_URL && !existsSync(path.join(root, 'packages/template-kit/dist/kit/tooling/cli.js'))) {
        throw new Error('No template kit: run `ddev exec pnpm build` (or `ddev exec pnpm --filter @openbill/template-kit build`) first.');
    }
    if (process.env.E2E_SKIP_SEED) return;

    const artisan = (...args: string[]) => execFileSync('ddev', ['artisan', ...args], { cwd: root, stdio: 'inherit' });
    artisan('db:seed', '--class=DemoSeeder', '--no-interaction');
    artisan('db:seed', '--class=E2eUserSeeder', '--no-interaction');
}
