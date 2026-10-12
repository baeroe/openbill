import type { TemplateDetail, TemplateFiles, TemplateManifest } from '@/api/templates';
import type { Paper } from '@/api/types';

export type Part = 'header' | 'body' | 'footer' | 'css' | 'manifest';
export const PARTS: Part[] = ['header', 'body', 'footer', 'css', 'manifest'];

/** Same as App\Rendering\Paper::DEFAULT. */
export const DEFAULT_PAPER: Paper = { format: 'A4', marginX: '20mm', headerHeight: '30mm', footerHeight: '20mm' };

/** line: 1-based line of a JSON syntax error when the engine reports it (marked in the manifest tab). */
export type ManifestProblem = { code: 'invalid_json' | 'not_object'; detail?: string; line?: number };

/** files.manifest is always the last valid manifest; manifestText is what the user typed. */
export type EditorState = { saved: TemplateFiles; files: TemplateFiles; manifestText: string; manifestProblem: ManifestProblem | null; part: Part };

export type EditorAction =
    | { type: 'part'; part: Part }
    | { type: 'edit'; part: Exclude<Part, 'manifest'>; value: string }
    | { type: 'manifest_text'; text: string }
    | { type: 'paper'; patch: Partial<Paper> }
    /** sent/sentText: what went out with the PUT (files and the manifest text at that moment). */
    | { type: 'saved'; template: TemplateDetail; sent: TemplateFiles; sentText: string }
    | { type: 'discard' };

const pretty = (manifest: TemplateManifest): string => JSON.stringify(manifest, null, 2);

const filesOf = (template: TemplateDetail): TemplateFiles => ({
    header: template.header,
    body: template.body,
    footer: template.footer,
    css: template.css,
    manifest: template.manifest,
});

/** Line of a JSON.parse error: "line 3 column 7" (Chromium, Firefox) or "position 42" (older engines). */
export function jsonErrorLine(text: string, message: string): number | null {
    const line = /line (\d+)/.exec(message);
    if (line) return Number(line[1]);
    const position = /position (\d+)/.exec(message);
    return position ? text.slice(0, Number(position[1])).split('\n').length : null;
}

export function parseManifest(text: string): { manifest: TemplateManifest } | { problem: ManifestProblem } {
    let parsed: unknown;
    try {
        parsed = JSON.parse(text);
    } catch (error) {
        const detail = error instanceof Error ? error.message : String(error);
        const line = jsonErrorLine(text, detail);
        return { problem: { code: 'invalid_json', detail, ...(line ? { line } : {}) } };
    }
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) return { problem: { code: 'not_object' } };
    return { manifest: parsed as TemplateManifest };
}

export function initEditor(template: TemplateDetail): EditorState {
    const files = filesOf(template);
    return { saved: files, files, manifestText: pretty(files.manifest), manifestProblem: null, part: 'body' };
}

export function editorReducer(state: EditorState, action: EditorAction): EditorState {
    switch (action.type) {
        case 'part':
            return { ...state, part: action.part };
        case 'edit':
            return { ...state, files: { ...state.files, [action.part]: action.value } };
        case 'manifest_text': {
            const result = parseManifest(action.text);
            return 'manifest' in result
                ? { ...state, manifestText: action.text, manifestProblem: null, files: { ...state.files, manifest: result.manifest } }
                : { ...state, manifestText: action.text, manifestProblem: result.problem };
        }
        case 'paper': {
            const manifest = { ...state.files.manifest, paper: { ...DEFAULT_PAPER, ...state.files.manifest.paper, ...action.patch } };
            return { ...state, files: { ...state.files, manifest }, manifestText: pretty(manifest), manifestProblem: null };
        }
        case 'saved': {
            const files = filesOf(action.template);
            // typed on while the PUT was running: keep those newer edits (still dirty against the new base)
            const unchanged = JSON.stringify(state.files) === JSON.stringify(action.sent) && state.manifestText === action.sentText;
            return unchanged ? { ...state, saved: files, files, manifestText: pretty(files.manifest), manifestProblem: null } : { ...state, saved: files };
        }
        case 'discard':
            return { ...state, files: state.saved, manifestText: pretty(state.saved.manifest), manifestProblem: null };
    }
}

export function isDirty(state: EditorState): boolean {
    return JSON.stringify(state.files) !== JSON.stringify(state.saved) || state.manifestText !== pretty(state.saved.manifest);
}

/** What PUT /api/templates/{id}/files gets; null while the manifest text is no valid JSON object. */
export function savePayload(state: EditorState): TemplateFiles | null {
    return state.manifestProblem ? null : state.files;
}

export function zoneOf(part: Part): 'header' | 'body' | 'footer' | null {
    return part === 'header' || part === 'body' || part === 'footer' ? part : null;
}
