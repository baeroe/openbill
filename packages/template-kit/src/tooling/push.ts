import { readFile } from 'node:fs/promises';
import path from 'node:path';
import type { OpenbillClient } from './client';
import type { KitEnv } from './env';
import { listTemplateFiles, MANIFEST_FILE, parseManifest, PART_FILES, TEMPLATE_DIR, TemplateProblemError, type Part } from './template-files';

/**
 * pnpm push: PUT /api/templates/{id}/files with the four parts, the manifest and the complete asset list (base64).
 * template/ is checked like the import first; nothing is sent while a problem is left. Only the template of
 * OPENBILL_TEMPLATE_ID – the token may not write any other (openbill answers 403).
 */
export async function push(root: string, env: KitEnv, client: OpenbillClient, log: (line: string) => void): Promise<void> {
    const dir = path.join(root, TEMPLATE_DIR);
    const { entries, problems } = await listTemplateFiles(dir);
    if (problems.length > 0) throw new TemplateProblemError('Nothing was pushed: fix template/ first.', problems);

    const text = async (file: string): Promise<string> => (entries.some((entry) => entry.path === file) ? readFile(path.join(dir, file), 'utf8') : '');
    const { manifest, problem } = parseManifest(await text(MANIFEST_FILE));
    if (manifest === null) {
        throw new TemplateProblemError('Nothing was pushed: manifest.json is broken.', [`${MANIFEST_FILE}${problem?.line ? `:${problem.line}` : ''}: ${problem?.message ?? 'unreadable'}`]);
    }

    const parts = {} as Record<Part, string>;
    for (const part of Object.keys(PART_FILES) as Part[]) parts[part] = await text(PART_FILES[part]);
    const assets: Record<string, string> = {};
    for (const entry of entries) {
        if (entry.path.startsWith('assets/')) assets[entry.path] = (await readFile(entry.absolute)).toString('base64');
    }

    const saved = await client.putFiles(env.templateId, { ...parts, manifest, assets });
    const count = Object.keys(assets).length;
    log(`Pushed "${saved.name}" ${saved.version} (${count} asset${count === 1 ? '' : 's'}) to ${env.url}.`);
}
