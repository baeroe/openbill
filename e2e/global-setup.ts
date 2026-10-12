import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');

/**
 * Fresh demo data and the e2e login before the run (E2E_SKIP_SEED=1 skips it).
 * Artisan runs in DDEV by default. E2E_ARTISAN replaces the command, e.g. for the Compose stack (CI job e2e):
 *   E2E_ARTISAN="e2e/compose.sh exec -T openbill php artisan"
 */
export default function globalSetup(): void {
    // against DDEV, assets and the template kit come from this working copy; another instance (OPENBILL_URL) has its own
    if (!process.env.OPENBILL_URL) {
        if (!existsSync(path.join(root, 'public/hot')) && !existsSync(path.join(root, 'public/build/manifest.json'))) {
            throw new Error('No frontend assets: run `ddev exec pnpm build` (or keep `ddev exec pnpm dev` running) first.');
        }
        // the toolkit download (toolkit.spec.ts) packs packages/template-kit/dist/kit
        if (!existsSync(path.join(root, 'packages/template-kit/dist/kit/tooling/cli.js'))) {
            throw new Error('No template kit: run `ddev exec pnpm build` (or `ddev exec pnpm --filter @openbill/template-kit build`) first.');
        }
    }
    if (process.env.E2E_SKIP_SEED) return;

    const [command, ...prefix] = (process.env.E2E_ARTISAN ?? 'ddev artisan').split(/\s+/).filter(Boolean);
    const artisan = (...args: string[]) => execFileSync(command, [...prefix, ...args], { cwd: root, stdio: 'inherit' });
    artisan('db:seed', '--class=DemoSeeder', '--no-interaction');
    artisan('db:seed', '--class=E2eUserSeeder', '--no-interaction');
}
