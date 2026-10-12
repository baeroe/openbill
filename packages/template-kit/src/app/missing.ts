import type { ExpectedField, RenderSchema, TemplateManifest } from '../shared/protocol';

/** manifest.expectedFields that are neither a core field nor a custom field of their level (they stay empty). Same rule as the template editor. */
export function missingExpectedFields(manifest: TemplateManifest | null, schema: RenderSchema | null): ExpectedField[] {
    if (manifest === null || schema === null) return [];
    return (manifest.expectedFields ?? []).filter((field) => {
        const level = schema.levels[field.scope];
        return level !== undefined && !level.core.includes(field.key) && !level.custom.some((custom) => custom.key === field.key);
    });
}
