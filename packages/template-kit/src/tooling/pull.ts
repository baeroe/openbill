import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { unzipSync } from 'fflate';
import type { OpenbillClient } from './client';
import type { KitEnv } from './env';
import { isSafePath, listTemplateFiles, MANIFEST_FILE, PART_FILES, TEMPLATE_DIR, TemplateProblemError } from './template-files';

const PACKAGE_FILES: string[] = [MANIFEST_FILE, ...Object.values(PART_FILES)];

/** The files of a template package ZIP that the toolkit writes; anything unsafe or unknown stops the pull. */
export function unpackPackage(zip: Uint8Array): Map<string, Uint8Array> {
    const files = new Map<string, Uint8Array>();
    const problems: string[] = [];
    for (const [name, contents] of Object.entries(unzipSync(zip))) {
        if (name.endsWith('/')) continue;
        if (!isSafePath(name) || !(PACKAGE_FILES.includes(name) || name.startsWith('assets/'))) {
            problems.push(`${name}: not written (unsafe or unknown path).`);
            continue;
        }
        files.set(name, contents);
    }
    if (problems.length > 0) throw new TemplateProblemError('The package from openbill contains files the toolkit does not write; nothing was changed.', problems);
    return files;
}

/**
 * pnpm pull: GET /api/templates/{id}/package into template/ and GET /api/render/schema into schema.json. When local
 * files differ (other content, or only here), nothing changes unless `force` – then they are overwritten or removed.
 */
export async function pull(root: string, env: KitEnv, client: OpenbillClient, { force, log }: { force: boolean; log(line: string): void }): Promise<void> {
    const dir = path.join(root, TEMPLATE_DIR);
    const files = unpackPackage(await client.packageZip(env.templateId));
    const local = await listTemplateFiles(dir);

    const changed: string[] = [];
    for (const entry of local.entries) {
        const incoming = files.get(entry.path);
        if (incoming === undefined || !Buffer.from(incoming).equals(await readFile(entry.absolute))) changed.push(entry.path);
    }
    if (changed.length > 0 && !force) {
        throw new TemplateProblemError('Local files differ from openbill; nothing was changed. Push them first, or overwrite them with `pnpm pull --force`:', changed);
    }

    for (const entry of local.entries) {
        if (!files.has(entry.path)) await rm(entry.absolute);
    }
    for (const [name, contents] of files) {
        const target = path.join(dir, ...name.split('/'));
        await mkdir(path.dirname(target), { recursive: true });
        await writeFile(target, contents);
    }
    await writeFile(path.join(root, 'schema.json'), `${JSON.stringify(await client.schema(), null, 2)}\n`);
    log(`Pulled ${files.size} files into template/ and the field schema into schema.json.`);
}
