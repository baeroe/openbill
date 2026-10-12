import type { IncomingMessage, ServerResponse } from 'node:http';
import path from 'node:path';
import type { Connect, Plugin, ViteDevServer } from 'vite';
import { KIT_API, RENDER_EVENT, type KitState, type Source } from '../shared/protocol';
import { createClient } from './client';
import { KitConfigError, readKitEnv, type KitEnv } from './env';
import { createRuntime, type KitRuntime } from './runtime';
import { TEMPLATE_DIR } from './template-files';

export type OpenbillRenderOptions = {
    /** Kit folder with template/ and .env.local; default: Vite's root. */
    root?: string;
    /** Instead of .env.local (tests). */
    env?: KitEnv;
    fetch?: typeof fetch;
    debounceMs?: number;
};

/** Virtual module injected into index.html: HMR events -> window events of the prebuilt page (no import.meta.hot there). */
export const BRIDGE_ID = '/@openbill/bridge.js';
const RESOLVED_BRIDGE = '\0openbill-bridge.js';
const BRIDGE_SOURCE = `// openbill-render: HMR events of the dev server -> window events of the preview page
if (import.meta.hot) {
    window.__openbillLive = true;
    import.meta.hot.on(${JSON.stringify(RENDER_EVENT)}, (data) => window.dispatchEvent(new CustomEvent(${JSON.stringify(RENDER_EVENT)}, { detail: data })));
}
`;

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);

/**
 * Only this computer may ask the dev server for renders (they carry real documents): a foreign Host header – DNS
 * rebinding from a web page – gets 403. Vite's own host check runs after this middleware, so it checks itself.
 */
export function isLocalHost(host: string | undefined, allowed: true | string[] | undefined): boolean {
    if (allowed === true) return true;
    const name = (host ?? '').toLowerCase().replace(/:\d+$/, '');
    if (LOCAL_HOSTS.has(name) || name.endsWith('.localhost')) return true;
    return (allowed ?? []).some((entry) => (entry.startsWith('.') ? name === entry.slice(1) || name.endsWith(entry) : name === entry));
}

/**
 * Only the preview page itself: a request with an Origin of another server (also one on localhost, e.g. :3000) or a
 * cross-site/same-site fetch gets 403. Same-origin GETs carry no Origin; POSTs carry the page's own one.
 */
export function isSameOrigin(headers: { host?: string; origin?: string; 'sec-fetch-site'?: string }): boolean {
    const site = headers['sec-fetch-site'];
    if (site === 'cross-site' || site === 'same-site') return false;
    if (headers.origin === undefined) return true;
    return headers.origin.toLowerCase() === `http://${(headers.host ?? '').toLowerCase()}`;
}

export function isSource(value: unknown): value is Source {
    if (typeof value !== 'object' || value === null) return false;
    const source = value as Record<string, unknown>;
    if (source.kind === 'document') return typeof source.id === 'string' && source.id !== '';
    return source.kind === 'scenario' && typeof source.key === 'string' && source.key !== '' && (source.locale === 'en' || source.locale === 'de');
}

function sendJson(res: ServerResponse, status: number, body: unknown): void {
    res.statusCode = status;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    res.end(JSON.stringify(body));
}

async function readJson(req: IncomingMessage): Promise<unknown> {
    const chunks: Buffer[] = [];
    let size = 0;
    for await (const chunk of req as AsyncIterable<Buffer>) {
        size += chunk.length;
        if (size > 64 * 1024) throw new Error('body too large');
        chunks.push(chunk);
    }
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

function configState(error: KitConfigError): KitState {
    return { instance: '', templateId: '', event: null, sources: null, schema: null, failure: { kind: 'config', status: null, message: error.message, details: error.problems } };
}

function kitMiddleware(server: ViteDevServer, runtime: KitRuntime | KitConfigError): Connect.NextHandleFunction {
    return (req, res, next) => {
        void (async () => {
            if (!isLocalHost(req.headers.host, server.config.server.allowedHosts)) {
                return sendJson(res, 403, { message: 'Only this computer (localhost) may use the openbill preview.' });
            }
            if (!isSameOrigin({ host: req.headers.host, origin: req.headers.origin, 'sec-fetch-site': req.headers['sec-fetch-site'] as string | undefined })) {
                return sendJson(res, 403, { message: 'Only the preview page itself may use these endpoints.' });
            }
            const route = `${req.method} ${(req.url ?? '').split('?')[0]}`;
            if (route === 'GET /state') {
                return sendJson(res, 200, runtime instanceof KitConfigError ? configState(runtime) : await runtime.state());
            }
            if (route === 'POST /source') {
                // JSON only: a cross-site form can't send it without a CORS preflight, which nobody answers
                if (!(req.headers['content-type'] ?? '').startsWith('application/json')) return sendJson(res, 415, { message: 'Send JSON.' });
                if (runtime instanceof KitConfigError) return sendJson(res, 409, configState(runtime).failure);
                const body = await readJson(req).catch(() => null);
                if (!isSource(body)) return sendJson(res, 422, { message: 'Unknown source.' });
                return sendJson(res, 200, await runtime.setSource(body));
            }
            next();
        })().catch(next);
    };
}

function isInside(dir: string, file: string): boolean {
    const relative = path.relative(dir, file);
    return relative !== '' && !relative.startsWith('..') && !path.isAbsolute(relative);
}

/**
 * pnpm dev of the template kit: watches template/, renders it on the openbill instance (POST /api/render with the
 * token of .env.local) and sends the result to the page as HMR event "openbill:render". The token never leaves Node.
 */
export function openbillRender(options: OpenbillRenderOptions = {}): Plugin {
    let root = '';

    return {
        name: 'openbill-render',
        apply: 'serve',
        configResolved(config) {
            root = options.root ?? config.root;
        },
        resolveId(id) {
            return id === BRIDGE_ID ? RESOLVED_BRIDGE : undefined;
        },
        load(id) {
            return id === RESOLVED_BRIDGE ? BRIDGE_SOURCE : undefined;
        },
        transformIndexHtml() {
            return [{ tag: 'script', attrs: { type: 'module', src: BRIDGE_ID }, injectTo: 'head-prepend' }];
        },
        configureServer(server) {
            let runtime: KitRuntime | KitConfigError;
            try {
                const env = options.env ?? readKitEnv(root);
                runtime = createRuntime({
                    root,
                    env,
                    client: createClient(env, options.fetch),
                    debounceMs: options.debounceMs,
                    send: (data) => server.ws.send({ type: 'custom', event: RENDER_EVENT, data }),
                    log: (message) => server.config.logger.info(`openbill: ${message}`, { timestamp: true }),
                });
            } catch (error) {
                if (!(error instanceof KitConfigError)) throw error;
                runtime = error;
                server.config.logger.error(`openbill: ${error.message}`);
            }
            server.watcher.add(path.join(root, TEMPLATE_DIR));
            server.watcher.on('all', (_event, file) => {
                if (!(runtime instanceof KitConfigError)) runtime.fileChanged(file);
            });
            server.middlewares.use(KIT_API, kitMiddleware(server, runtime));
            server.httpServer?.once('close', () => {
                if (!(runtime instanceof KitConfigError)) runtime.dispose();
            });
        },
        // template files are no modules: Vite must never reload the page for them (the render event updates it)
        handleHotUpdate({ file }) {
            if (isInside(path.join(root, TEMPLATE_DIR), file)) return [];
        },
    };
}
