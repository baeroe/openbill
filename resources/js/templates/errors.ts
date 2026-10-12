import type { ExpectedField, RenderSchema, TemplateManifest } from '@/api/templates';
import type { RenderErrorItem } from '@/api/types';
import type { LineError } from './diagnostics';
import { PARTS, type Part } from './editor-state';

/** Errors of POST /api/render per editor tab; intro/closing errors come from the document and stay in the list only. */
export function errorsByPart(errors: RenderErrorItem[]): Record<Part, LineError[]> {
    const byPart = Object.fromEntries(PARTS.map((part) => [part, [] as LineError[]])) as Record<Part, LineError[]>;
    for (const error of errors) {
        if ((PARTS as string[]).includes(error.part)) byPart[error.part as Part].push({ line: error.line, message: error.message });
    }
    return byPart;
}

export function errorLabel(error: RenderErrorItem): string {
    const where = error.file ?? error.part;
    return error.line ? `${where}:${error.line}` : where;
}

/** manifest.expectedFields that are neither a core field nor a custom field of their level (they stay empty). */
export function missingExpectedFields(manifest: TemplateManifest, schema: RenderSchema): ExpectedField[] {
    return (manifest.expectedFields ?? []).filter((field) => {
        const level = schema.levels[field.scope];
        return level !== undefined && !level.core.includes(field.key) && !level.custom.some((custom) => custom.key === field.key);
    });
}
