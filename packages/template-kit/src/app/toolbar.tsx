import type { RenderSources, Source, TemplateManifest } from '../shared/protocol';
import { documentLabel, pagesLabel, parseSource, SCENARIO_LABELS, sourceValue } from './describe';

type Props = {
    manifest: TemplateManifest | null;
    instance: string;
    connected: boolean;
    sources: RenderSources | null;
    source: Source | null;
    pages: number;
    guides: boolean;
    onSource(source: Source): void;
    onGuides(next: boolean): void;
};

const host = (url: string): string => {
    try {
        return new URL(url).host;
    } catch {
        return 'no instance';
    }
};

export function Toolbar({ manifest, instance, connected, sources, source, pages, guides, onSource, onGuides }: Props) {
    const name = typeof manifest?.name === 'string' && manifest.name !== '' ? manifest.name : 'Template';
    const version = typeof manifest?.version === 'string' ? manifest.version : null;
    const locale = source?.kind === 'scenario' ? source.locale : 'en';

    return (
        <header className="kit-bar">
            <div className="kit-title">
                <strong>{name}</strong>
                {version && <span className="kit-muted">{version}</span>}
            </div>
            <span className={connected ? 'kit-chip' : 'kit-chip kit-chip--bad'} title={connected ? 'Live: every save in template/ renders again' : 'Not connected to pnpm dev'}>
                <span className="kit-dot" aria-hidden />
                {host(instance)}
            </span>
            <span className="kit-spacer" />
            {sources && source && (
                <label className="kit-field">
                    <span>Data</span>
                    <select
                        value={sourceValue(source)}
                        onChange={(event) => {
                            const next = parseSource(event.target.value, locale);
                            if (next) onSource(next);
                        }}
                    >
                        <optgroup label="Sample data">
                            {sources.scenarios.map((scenario) => (
                                <option key={scenario.key} value={`scenario:${scenario.key}`}>
                                    {SCENARIO_LABELS[scenario.key] ?? scenario.key}
                                </option>
                            ))}
                        </optgroup>
                        {sources.documents.length > 0 && (
                            <optgroup label="Documents">
                                {sources.documents.map((document) => (
                                    <option key={document.id} value={`document:${document.id}`}>
                                        {documentLabel(document)}
                                    </option>
                                ))}
                            </optgroup>
                        )}
                    </select>
                </label>
            )}
            {source?.kind === 'scenario' && (
                <label className="kit-field">
                    <span>Language</span>
                    <select value={locale} onChange={(event) => onSource({ ...source, locale: event.target.value === 'de' ? 'de' : 'en' })}>
                        <option value="en">English</option>
                        <option value="de">Deutsch</option>
                    </select>
                </label>
            )}
            <button type="button" className="kit-button" aria-pressed={guides} onClick={() => onGuides(!guides)} title="Show header, content and footer areas">
                Areas
            </button>
            <span className="kit-muted kit-pages" aria-live="polite">
                {pagesLabel(pages)}
            </span>
        </header>
    );
}
