import { PagedPreview } from '@openbill/paged-preview';
import { useEffect, useMemo, useState } from 'react';
import type { KitError } from '../shared/protocol';
import { ErrorOverlay } from './error-overlay';
import { FieldList } from './field-list';
import { missingExpectedFields } from './missing';
import { useStoredFlag } from './stored-flag';
import { Toolbar } from './toolbar';
import { useKit } from './use-kit';

export function App() {
    const { state, event, connected, loadError, setSource } = useKit();
    const [guides, setGuides] = useStoredFlag('openbill-kit:guides', false);
    const [pages, setPages] = useState(1);
    const [status, setStatus] = useState<string | null>(null);
    const manifest = event?.manifest ?? null;
    const schema = state?.schema ?? null;
    const missing = useMemo(() => missingExpectedFields(manifest, schema), [manifest, schema]);
    const unreachable: KitError | null = loadError ? { kind: 'network', status: null, message: `The page lost the dev server (${loadError}). Is pnpm dev still running?`, details: [] } : null;
    const failure = event?.failure ?? state?.failure ?? unreachable;

    useEffect(() => {
        if (status === null) return;
        const timer = setTimeout(() => setStatus(null), 2500);
        return () => clearTimeout(timer);
    }, [status]);

    const copy = async (code: string) => {
        try {
            await navigator.clipboard.writeText(code);
            setStatus(`Copied ${code}`);
        } catch {
            setStatus(`Copying failed – the expression is ${code}`);
        }
    };

    return (
        <div className="kit">
            <Toolbar
                manifest={manifest}
                instance={state?.instance ?? ''}
                connected={connected}
                sources={state?.sources ?? null}
                source={event?.source ?? null}
                pages={pages}
                guides={guides}
                onSource={(source) => void setSource(source)}
                onGuides={setGuides}
            />
            <div className="kit-body">
                <FieldList schema={schema} missing={missing} onCopy={(code) => void copy(code)} />
                <main className="kit-main" aria-label="Preview">
                    {!connected && (
                        <p className="kit-note kit-note--bad">
                            Live updates are off: open this page through <code>pnpm dev</code>.
                        </p>
                    )}
                    {event?.notice === 'assets_changed' && (
                        <p className="kit-note">
                            assets/ changed. The preview uses the assets saved in openbill – run <code>pnpm push</code> to use the new files.
                        </p>
                    )}
                    {missing.length > 0 && (
                        <p className="kit-note kit-note--warn">
                            manifest.json expects fields openbill does not have: {missing.map((field) => `${field.scope}.${field.key}`).join(', ')}. They stay empty until you create them under Custom fields.
                        </p>
                    )}
                    {event?.result ? (
                        <PagedPreview parts={event.result} paper={event.result.paper} lazy showGuides={guides} onPageCount={setPages} />
                    ) : (
                        <div className="kit-empty">{failure ? 'No preview yet.' : 'Rendering…'}</div>
                    )}
                </main>
            </div>
            <ErrorOverlay failure={failure} errors={event?.errors ?? []} hasPreview={!!event?.result} />
            {status && (
                <div role="status" className="kit-toast">
                    {status}
                </div>
            )}
        </div>
    );
}
