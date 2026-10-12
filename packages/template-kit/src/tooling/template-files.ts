import { lstat, readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import type { ExcerptLine, TemplateManifest } from '../shared/protocol';

/** Folder of the template sources inside the kit. */
export const TEMPLATE_DIR = 'template';
/** Part of POST /api/render and PUT /api/templates/{id}/files => file (App\Rendering\TemplatePackage::FILES). */
export const PART_FILES = { header: 'header.liquid', body: 'template.liquid', footer: 'footer.liquid', css: 'styles.css' } as const;
export type Part = keyof typeof PART_FILES;
export const MANIFEST_FILE = 'manifest.json';
export const REQUIRED_FILES = [MANIFEST_FILE, PART_FILES.body];

/** config/openbill.php "templates" and TemplatePackage::ASSET_TYPES (limits.drift.test.ts keeps them equal). */
export const LIMITS = { assetBytes: 2 * 1024 * 1024, totalBytes: 20 * 1024 * 1024, entries: 100 } as const;
export const ASSET_EXTENSIONS = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'woff', 'woff2', 'ttf', 'otf'] as const;

export type ManifestProblem = { line: number | null; message: string };
export type LocalTemplate = { parts: Record<Part, string>; manifestText: string; manifest: TemplateManifest | null; manifestProblem: ManifestProblem | null };
export type TemplateEntry = { path: string; absolute: string; size: number };

/** Local problems of template/ (push, pull, pack); nothing was sent or written. */
export class TemplateProblemError extends Error {
    constructor(
        message: string,
        readonly problems: string[],
    ) {
        super(message);
        this.name = 'TemplateProblemError';
    }
}

/** Like TemplatePackage::safePath(): relative, "/" only, no ".", ".." or empty segment, no drive letter. */
export function isSafePath(name: string): boolean {
    if (name === '' || name.includes('\0') || name.includes('\\') || name.startsWith('/') || /^[A-Za-z]:/.test(name)) return false;
    return name.split('/').every((segment) => segment !== '' && segment !== '.' && segment !== '..');
}

/** Line of a JSON.parse error: Node names "line X column Y", older engines only a position. */
export function jsonErrorLine(text: string, message: string): number | null {
    const lineColumn = /line (\d+) column \d+/.exec(message);
    if (lineColumn) return Number(lineColumn[1]);
    const position = /position (\d+)/.exec(message);
    if (position) return text.slice(0, Number(position[1])).split('\n').length;
    return null;
}

/** manifest.json as object, or where it breaks. */
export function parseManifest(text: string): { manifest: TemplateManifest | null; problem: ManifestProblem | null } {
    try {
        const value: unknown = JSON.parse(text);
        if (value === null || typeof value !== 'object' || Array.isArray(value)) {
            return { manifest: null, problem: { line: 1, message: 'manifest.json must be a JSON object.' } };
        }
        return { manifest: value as TemplateManifest, problem: null };
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return { manifest: null, problem: { line: jsonErrorLine(text, message), message: `manifest.json is not valid JSON: ${message}` } };
    }
}

async function readOptional(file: string): Promise<string> {
    try {
        return await readFile(file, 'utf8');
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') return '';
        throw error;
    }
}

/** The parts and the manifest as the dev server renders them; a missing optional part is empty. */
export async function readTemplate(templateDir: string): Promise<LocalTemplate> {
    const read = (file: string) => readOptional(path.join(templateDir, file));
    const parts: Record<Part, string> = {
        header: await read(PART_FILES.header),
        body: await read(PART_FILES.body),
        footer: await read(PART_FILES.footer),
        css: await read(PART_FILES.css),
    };
    const manifestText = await read(MANIFEST_FILE);
    const { manifest, problem } = manifestText === '' ? { manifest: null, problem: { line: null, message: `${TEMPLATE_DIR}/${MANIFEST_FILE} is missing.` } } : parseManifest(manifestText);

    return { parts, manifestText, manifest, manifestProblem: problem };
}

/** Lines around `line` (1-based) of a source, for the error overlay. */
export function excerpt(source: string, line: number, around = 2): ExcerptLine[] {
    const lines = source.split('\n');
    const result: ExcerptLine[] = [];
    for (let n = Math.max(1, line - around); n <= Math.min(lines.length, line + around); n++) {
        result.push({ line: n, text: lines[n - 1] });
    }
    return result;
}

const mb = (bytes: number): string => `${(bytes / 1024 / 1024).toFixed(1)} MB`;

/**
 * Every file of template/ that belongs into a template package, checked like the import (TemplatePackage::fromZip):
 * manifest.json and the four parts at the top, assets/… with an allowed extension, no symbolic links, no other files,
 * sizes and count within LIMITS. Hidden files (.DS_Store, .gitkeep, …) are skipped. Problems are collected, never thrown.
 */
export async function listTemplateFiles(templateDir: string): Promise<{ entries: TemplateEntry[]; problems: string[] }> {
    const entries: TemplateEntry[] = [];
    const problems: string[] = [];
    const known: string[] = [MANIFEST_FILE, ...Object.values(PART_FILES)];

    const walk = async (relative: string): Promise<void> => {
        const dir = relative === '' ? templateDir : path.join(templateDir, ...relative.split('/'));
        for (const name of (await readdir(dir)).sort()) {
            if (name.startsWith('.')) continue;
            const rel = relative === '' ? name : `${relative}/${name}`;
            const absolute = path.join(dir, name);
            const stat = await lstat(absolute);
            if (stat.isSymbolicLink()) {
                problems.push(`${rel}: symbolic links are not allowed.`);
            } else if (stat.isDirectory()) {
                if (rel === 'assets' || rel.startsWith('assets/')) await walk(rel);
                else problems.push(`${rel}/: only assets/ may contain folders.`);
            } else if (!stat.isFile() || !isSafePath(rel)) {
                problems.push(`${rel}: not a regular file with a safe name.`);
            } else if (rel.startsWith('assets/')) {
                const extension = path.extname(rel).slice(1).toLowerCase();
                if (!(ASSET_EXTENSIONS as readonly string[]).includes(extension)) problems.push(`${rel}: assets must be ${ASSET_EXTENSIONS.join(', ')}.`);
                else if (stat.size > LIMITS.assetBytes) problems.push(`${rel}: ${mb(stat.size)} is larger than ${mb(LIMITS.assetBytes)} per asset.`);
                else entries.push({ path: rel, absolute, size: stat.size });
            } else if (!known.includes(rel)) {
                problems.push(`${rel}: unknown file (allowed: ${known.join(', ')}, assets/…).`);
            } else {
                entries.push({ path: rel, absolute, size: stat.size });
            }
        }
    };

    try {
        await walk('');
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') return { entries: [], problems: [`${TEMPLATE_DIR}/ is missing.`] };
        throw error;
    }
    for (const required of REQUIRED_FILES) {
        if (!entries.some((entry) => entry.path === required)) problems.push(`${required} is missing.`);
    }
    const total = entries.reduce((sum, entry) => sum + entry.size, 0);
    if (total > LIMITS.totalBytes) problems.push(`template/ holds ${mb(total)}, at most ${mb(LIMITS.totalBytes)} are allowed.`);
    if (entries.length > LIMITS.entries) problems.push(`${entries.length} files, at most ${LIMITS.entries} are allowed.`);
    entries.sort((a, b) => (a.path < b.path ? -1 : 1));

    return { entries, problems: problems.sort() };
}
