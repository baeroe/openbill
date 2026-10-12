import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { zipSync } from 'fflate';
import { listTemplateFiles, MANIFEST_FILE, parseManifest, TEMPLATE_DIR, TemplateProblemError } from './template-files';

/** File name part from the template name: "Hotel Alpenglück" → "hotel-alpengluck". */
export function slug(name: string): string {
    return (
        name
            .normalize('NFKD')
            .replace(/[̀-ͯ]/g, '')
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '') || 'template'
    );
}

/**
 * pnpm run pack: template/ as template package ZIP (files at the top, assets/…) for Templates → Import ZIP – the format
 * TemplatePackage::fromZip reads. Same checks as push; nothing is written while a problem is left.
 */
export async function pack(root: string, { out, log }: { out?: string; log(line: string): void }): Promise<string> {
    const dir = path.join(root, TEMPLATE_DIR);
    const { entries, problems } = await listTemplateFiles(dir);
    if (problems.length > 0) throw new TemplateProblemError('No package was written: fix template/ first.', problems);

    const { manifest, problem } = parseManifest(await readFile(path.join(dir, MANIFEST_FILE), 'utf8'));
    if (manifest === null) throw new TemplateProblemError('No package was written: manifest.json is broken.', [`${MANIFEST_FILE}${problem?.line ? `:${problem.line}` : ''}: ${problem?.message ?? 'unreadable'}`]);
    const name = typeof manifest.name === 'string' ? manifest.name.trim() : '';
    const version = typeof manifest.version === 'string' ? manifest.version.trim() : '';
    if (name === '' || version === '') throw new TemplateProblemError('No package was written: manifest.json needs "name" and "version".', []);

    const files: Record<string, Uint8Array> = {};
    for (const entry of entries) files[entry.path] = new Uint8Array(await readFile(entry.absolute));
    const target = path.resolve(root, out ?? `${slug(name)}-${version.replace(/[^A-Za-z0-9._-]+/g, '-')}.zip`);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, zipSync(files, { level: 6 }));
    log(`Packed ${entries.length} files into ${path.relative(root, target)} (import it under Templates → Import ZIP).`);

    return target;
}
