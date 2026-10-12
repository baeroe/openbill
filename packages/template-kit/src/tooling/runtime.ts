import path from 'node:path';
import type { KitError, KitState, RenderErrorItem, RenderEvent, RenderResult, RenderSchema, RenderSources, Source } from '../shared/protocol';
import { OpenbillError, renderRequest, type OpenbillClient } from './client';
import type { KitEnv } from './env';
import { excerpt, MANIFEST_FILE, PART_FILES, readTemplate, TEMPLATE_DIR, type LocalTemplate } from './template-files';

export type RuntimeOptions = {
    root: string;
    env: KitEnv;
    client: OpenbillClient;
    /** Pushes an event to every open preview (HMR event openbill:render). */
    send(event: RenderEvent): void;
    debounceMs?: number;
    log?(message: string): void;
};

export type KitRuntime = {
    /** Sources, schema and the newest event; loads them (and renders once) on the first call. */
    state(): Promise<KitState>;
    setSource(source: Source): Promise<RenderEvent>;
    /** A file changed somewhere below the kit; only template/ counts. */
    fileChanged(file: string): void;
    render(): Promise<RenderEvent>;
    dispose(): void;
};

/** Like the template editor: the newest document, else the long sample invoice (several pages). */
export function defaultSource(sources: RenderSources | null): Source {
    const [latest] = sources?.documents ?? [];
    return latest ? { kind: 'document', id: latest.id } : { kind: 'scenario', key: 'long_invoice', locale: 'en' };
}

function failureOf(error: unknown): KitError {
    if (error instanceof OpenbillError) return error.failure;
    return { kind: 'server', status: null, message: error instanceof Error ? error.message : String(error), details: [] };
}

function withExcerpts(errors: RenderErrorItem[], local: LocalTemplate): RenderErrorItem[] {
    const sources: Record<string, string> = {
        [PART_FILES.header]: local.parts.header,
        [PART_FILES.body]: local.parts.body,
        [PART_FILES.footer]: local.parts.footer,
        [PART_FILES.css]: local.parts.css,
        [MANIFEST_FILE]: local.manifestText,
    };
    return errors.map((error) => (error.file && error.line && sources[error.file] !== undefined ? { ...error, excerpt: excerpt(sources[error.file], error.line) } : error));
}

/**
 * Renders the local template on the instance (POST /api/render) whenever a file in template/ changes: debounced,
 * newest wins (an older request is aborted and never overwrites a newer answer), template errors with lines of the
 * local file. The preview keeps the newest result without template errors.
 */
export function createRuntime({ root, env, client, send, debounceMs = 80, log = () => undefined }: RuntimeOptions): KitRuntime {
    const templateDir = path.join(root, TEMPLATE_DIR);
    let source: Source | null = null;
    let sources: RenderSources | null = null;
    let schema: RenderSchema | null = null;
    let lookupFailure: KitError | null = null;
    let lookups: Promise<void> | null = null;
    let last: RenderEvent | null = null;
    let lastGood: RenderResult | null = null;
    let seq = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let running: AbortController | null = null;
    let assetsChanged = false;

    const loadLookups = (): Promise<void> =>
        (lookups ??= Promise.all([client.sources(), client.schema()]).then(
            ([loadedSources, loadedSchema]) => {
                sources = loadedSources;
                schema = loadedSchema;
                lookupFailure = null;
            },
            (error: unknown) => {
                lookupFailure = failureOf(error);
                lookups = null; // ask again with the next state request
            },
        ));

    const render = async (): Promise<RenderEvent> => {
        clearTimeout(timer);
        running?.abort();
        const controller = new AbortController();
        running = controller;
        const id = ++seq;
        if (source === null) {
            await loadLookups();
            source ??= defaultSource(sources);
        }
        const current = source;
        const notice: RenderEvent['notice'] = assetsChanged ? 'assets_changed' : null;
        assetsChanged = false;
        const local = await readTemplate(templateDir);
        const make = (fields: Pick<RenderEvent, 'manifest' | 'result' | 'errors' | 'failure'>): RenderEvent => ({ seq: id, at: new Date().toISOString(), source: current, notice, ...fields });

        let event: RenderEvent;
        if (local.manifest === null) {
            const problem = local.manifestProblem;
            event = make({
                manifest: last?.manifest ?? null,
                result: lastGood,
                errors: [],
                failure: { kind: 'manifest', status: null, message: problem?.message ?? 'manifest.json is broken.', details: problem?.line ? [`${MANIFEST_FILE}:${problem.line}`] : [] },
            });
        } else {
            try {
                const result = await client.render(renderRequest(env.templateId, current, { ...local.parts, manifest: local.manifest }), controller.signal);
                const errors = withExcerpts(result.errors, local);
                if (errors.length === 0) lastGood = result;
                event = make({ manifest: local.manifest, result: errors.length === 0 ? result : (lastGood ?? result), errors, failure: null });
            } catch (error) {
                event = make({ manifest: local.manifest, result: lastGood, errors: [], failure: failureOf(error) });
            }
        }

        // a newer render started meanwhile: it sends its own event, this one must never overwrite it
        if (id !== seq) return event;
        running = null;
        last = event;
        send(event);
        log(event.failure ? event.failure.message : event.errors.length > 0 ? `${event.errors.length} template error(s)` : 'rendered');
        return event;
    };

    return {
        state: async () => {
            await loadLookups();
            if (last === null) await render();
            return { instance: env.url, templateId: env.templateId, event: last, sources, schema, failure: lookupFailure };
        },
        setSource: async (next) => {
            source = next;
            return render();
        },
        fileChanged: (file) => {
            const relative = path.relative(templateDir, path.resolve(file));
            if (relative === '' || relative.startsWith('..') || path.isAbsolute(relative)) return;
            if (relative.split(path.sep)[0] === 'assets') assetsChanged = true;
            clearTimeout(timer);
            timer = setTimeout(() => void render(), debounceMs);
        },
        render,
        dispose: () => {
            clearTimeout(timer);
            running?.abort();
        },
    };
}
