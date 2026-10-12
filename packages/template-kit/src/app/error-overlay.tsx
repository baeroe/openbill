import { useState } from 'react';
import type { KitError, RenderErrorItem } from '../shared/protocol';
import { errorLabel } from './describe';

/** Template errors (file, line, excerpt) and failures (instance, token, manifest.json) over the preview. */
export function ErrorOverlay({ failure, errors, hasPreview }: { failure: KitError | null; errors: RenderErrorItem[]; hasPreview: boolean }) {
    const key = JSON.stringify([failure?.message ?? null, errors.map((error) => [error.file, error.line, error.message])]);
    const [hidden, setHidden] = useState<string | null>(null);
    if ((failure === null && errors.length === 0) || hidden === key) return null;

    const title = failure ? 'No new preview' : errors.length === 1 ? 'Template error' : `${errors.length} template errors`;

    return (
        <section className="kit-overlay" role="alert" aria-label="Template problems">
            <header>
                <strong>{title}</strong>
                {hasPreview && <span className="kit-muted kit-small">The preview shows the last working state.</span>}
                <button type="button" className="kit-button" onClick={() => setHidden(key)}>
                    Hide
                </button>
            </header>
            {failure && (
                <div className="kit-problem">
                    <p>{failure.message}</p>
                    {failure.details.length > 0 && (
                        <ul>
                            {failure.details.map((detail) => (
                                <li key={detail}>
                                    <code>{detail}</code>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            )}
            {errors.map((error, index) => (
                <div key={`${error.file}:${error.line}:${index}`} className="kit-problem">
                    <p>
                        <code className="kit-where">{errorLabel(error)}</code> {error.message}
                    </p>
                    {error.excerpt && error.excerpt.length > 0 && (
                        <pre className="kit-excerpt">
                            {error.excerpt.map((line) => (
                                <span key={line.line} className={line.line === error.line ? 'kit-excerpt-hit' : undefined}>
                                    <span className="kit-ln">{line.line}</span>
                                    {line.text}
                                </span>
                            ))}
                        </pre>
                    )}
                </div>
            ))}
        </section>
    );
}
