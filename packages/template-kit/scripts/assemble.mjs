// Copies the files of the end user's kit (package.json, README, AGENTS.md, vite.config.js, pnpm-workspace.yaml) next to the built
// preview page and tooling. Runs last in `pnpm build`.
import { cpSync, existsSync, readdirSync } from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const target = path.join(root, 'dist/kit');

for (const file of ['index.html', 'tooling/plugin.js', 'tooling/cli.js']) {
    if (!existsSync(path.join(target, file))) throw new Error(`dist/kit/${file} is missing: run both vite builds first.`);
}
cpSync(path.join(root, 'kit-files'), target, { recursive: true });
console.log(`template kit → ${path.relative(process.cwd(), target)}: ${readdirSync(target).sort().join(', ')}`);
