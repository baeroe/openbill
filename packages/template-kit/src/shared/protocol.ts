/**
 * What the dev server (Node, holds the token) and the preview page (browser, never sees the token) exchange.
 * Shapes of openbill's answers: POST /api/render, GET /api/render/sources, GET /api/render/schema.
 */

/** HMR event of the plugin and window event of the bridge module. */
export const RENDER_EVENT = 'openbill:render';
/** Prefix of the dev server's own endpoints (plugin middleware). */
export const KIT_API = '/__openbill';

export type Paper = { format: string; marginX: string; headerHeight: string; footerHeight: string };
export type FieldScope = 'org' | 'customer' | 'contact' | 'document' | 'position';
export type FieldType = 'text' | 'textarea' | 'number' | 'money' | 'date' | 'select' | 'boolean' | 'image';
export type ExpectedField = { scope: FieldScope; key: string; type: FieldType };

/** manifest.json as far as the kit reads it; everything else goes to openbill untouched. */
export type TemplateManifest = {
    name?: unknown;
    version?: unknown;
    expectedFields?: ExpectedField[];
    paper?: Paper;
    [key: string]: unknown;
};

export type Source = { kind: 'scenario'; key: string; locale: 'en' | 'de' } | { kind: 'document'; id: string };

export type RenderSources = {
    scenarios: { key: string; document_type: string }[];
    documents: { id: string; type: string; status: string; number: string | null; date: string; customer_name: string | null; locale: string }[];
};

export type SchemaField = { key: string; label: string; type: FieldType; required: boolean; options: string[]; doc_types: string[] };
export type RenderSchema = { levels: Record<FieldScope, { context: string; core: string[]; custom: SchemaField[] }> };

export type ExcerptLine = { line: number; text: string };
/** A template error of POST /api/render; the dev server adds lines of the local file around it. */
export type RenderErrorItem = { part: string; file: string | null; line: number | null; message: string; excerpt?: ExcerptLine[] };
export type RenderResult = { header: string; body: string; footer: string; paper: Paper; errors: RenderErrorItem[] };

export type KitErrorKind = 'config' | 'network' | 'unauthorized' | 'forbidden' | 'not_found' | 'conflict' | 'validation' | 'too_large' | 'server' | 'manifest';
/** Why there is no new preview (or why push/pull failed), in words for the template author. */
export type KitError = { kind: KitErrorKind; status: number | null; message: string; details: string[] };

export type RenderEvent = {
    /** Grows with every render of this dev server: the page never replaces a newer event with an older one. */
    seq: number;
    at: string;
    source: Source;
    manifest: TemplateManifest | null;
    /** What the preview shows: the newest result without template errors (null before the first one). */
    result: RenderResult | null;
    /** Template errors of the newest render (with excerpt). */
    errors: RenderErrorItem[];
    /** The newest render did not happen: instance unreachable, token refused, broken manifest.json, … */
    failure: KitError | null;
    notice: 'assets_changed' | null;
};

export type KitState = {
    instance: string;
    templateId: string;
    event: RenderEvent | null;
    sources: RenderSources | null;
    schema: RenderSchema | null;
    /** Sources/schema could not be loaded, or .env.local is incomplete. */
    failure: KitError | null;
};
