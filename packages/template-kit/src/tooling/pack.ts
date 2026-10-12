import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { zipSync } from 'fflate';
import { LIMITS, listTemplateFiles, MANIFEST_FILE, mb, parseManifest, TEMPLATE_DIR, TemplateProblemError } from './template-files';

/** File name part from the template name: "Hotel Alpenglück" → "hotel-alpengluck". */
export function slug(name: string): string {
    return (
        name
            .normalize('NFKD')
            .replace(/[\u0300-\u036f]/g, '')
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
    const zip = zipSync(files, { level: 6 });
    // the import takes at most templates.max_package_bytes – compressed assets (png, woff2) hardly shrink
    if (zip.length > LIMITS.packageBytes) {
        throw new TemplateProblemError('No package was written: it is too large for the import.', [`The package would be ${mb(zip.length)}, at most ${mb(LIMITS.packageBytes)} are allowed.`]);
    }
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, zip);
    log(`Packed ${entries.length} files into ${path.relative(root, target)} (import it under Templates → Import ZIP).`);

    return target;
}
