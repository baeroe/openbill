import type { ExpectedField, FieldScope, RenderSchema } from '../shared/protocol';
import { expression, liquidPath } from './fields';

const SCOPES: FieldScope[] = ['org', 'customer', 'contact', 'document', 'position'];
const SCOPE_LABELS: Record<FieldScope, string> = { org: 'Organization', customer: 'Customer', contact: 'Contact', document: 'Document', position: 'Position' };

/** Core and custom fields per level; a click copies the Liquid expression. Expected fields openbill lacks are marked. */
export function FieldList({ schema, missing, onCopy }: { schema: RenderSchema | null; missing: ExpectedField[]; onCopy(code: string): void }) {
    return (
        <aside className="kit-fields" aria-label="Fields">
            <h2 className="kit-h2">Fields</h2>
            <p className="kit-muted kit-small">A click copies the Liquid expression.</p>
            {schema === null ? (
                <p className="kit-muted kit-small">Loading…</p>
            ) : (
                SCOPES.map((scope) => {
                    const level = schema.levels[scope];
                    return (
                        <section key={scope} className="kit-level">
                            <h3>
                                {SCOPE_LABELS[scope]} <code>{level.context}</code>
                            </h3>
                            <ul>
                                {missing
                                    .filter((field) => field.scope === scope)
                                    .map((field) => (
                                        <li key={`missing-${field.key}`}>
                                            <button type="button" className="kit-field-item kit-field-item--missing" onClick={() => onCopy(expression(scope, field.key, field.type))} title="Expected by manifest.json, but openbill has no such field: it stays empty.">
                                                <span>{field.key}</span>
                                                <span className="kit-badge kit-badge--warn">missing</span>
                                                <code>{liquidPath(scope, field.key)}</code>
                                            </button>
                                        </li>
                                    ))}
                                {level.custom.map((field) => (
                                    <li key={`custom-${field.key}`}>
                                        <button type="button" className="kit-field-item" onClick={() => onCopy(expression(scope, field.key, field.type))} title={expression(scope, field.key, field.type)}>
                                            <span>{field.label}</span>
                                            <span className="kit-badge">{field.type}</span>
                                            <code>{liquidPath(scope, field.key)}</code>
                                        </button>
                                    </li>
                                ))}
                                {level.core.map((key) => (
                                    <li key={`core-${key}`}>
                                        <button type="button" className="kit-field-item kit-field-item--core" onClick={() => onCopy(expression(scope, key))} title={expression(scope, key)}>
                                            <code>{liquidPath(scope, key)}</code>
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        </section>
                    );
                })
            )}
        </aside>
    );
}
