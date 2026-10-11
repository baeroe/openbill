import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');

/** Fresh demo data and the e2e login in the DDEV database (PHP runs only in DDEV). E2E_SKIP_SEED=1 skips it. */
export default function globalSetup(): void {
    if (!existsSync(path.join(root, 'public/hot')) && !existsSync(path.join(root, 'public/build/manifest.json'))) {
        throw new Error('No frontend assets: run `ddev exec pnpm build` (or keep `ddev exec pnpm dev` running) first.');
    }
    if (process.env.E2E_SKIP_SEED) return;

    const artisan = (...args: string[]) => execFileSync('ddev', ['artisan', ...args], { cwd: root, stdio: 'inherit' });
    artisan('db:seed', '--class=DemoSeeder', '--no-interaction');
    artisan('db:seed', '--class=E2eUserSeeder', '--no-interaction');
}
