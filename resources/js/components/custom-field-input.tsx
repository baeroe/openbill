import { useEffect, useState, type ReactNode } from 'react';
import type { CustomValue, FieldDefinition } from '@/api/types';
import { controlClass, cx, Field, SelectControl, Switch, Textarea, TextInput } from '@/components/ui';
import { toDecimalString } from '@/lib/format';
import { t } from '@/lib/i18n';

type Props = {
    definition: FieldDefinition;
    value: CustomValue | undefined;
    onChange(value: CustomValue): void;
    error?: string;
    disabled?: boolean;
    /** Without label and hint (position rows of the editor in phase 6); the label becomes aria-label. */
    compact?: boolean;
    path?: string;
};

/** Input for one custom field by its type. Numbers and amounts stay strings with a dot (the API refuses floats). */
export function CustomFieldInput({ definition, value, onChange, error, disabled = false, compact = false, path }: Props) {
    const label: ReactNode = compact ? undefined : (
        <>
            {definition.label}
            {definition.required && <span aria-hidden> *</span>}
        </>
    );
    const hint = compact ? undefined : definition.help || undefined;
    const text = value === null || value === undefined ? '' : String(value);
    const aria = compact ? definition.label : undefined;

    switch (definition.type) {
        case 'textarea':
            return <Textarea label={label} hint={hint} error={error} path={path} value={text} disabled={disabled} aria-label={aria} onChange={(e) => onChange(e.target.value)} />;
        case 'number':
        case 'money':
            return <DecimalInput label={label} hint={hint} error={error} path={path} value={text} disabled={disabled} aria={aria} money={definition.type === 'money'} onChange={onChange} />;
        case 'date':
            return <TextInput type="date" label={label} hint={hint} error={error} path={path} value={text} disabled={disabled} aria-label={aria} onChange={(e) => onChange(e.target.value || null)} />;
        case 'select':
            return (
                <Field label={label} hint={hint} error={error} path={path}>
                    {(id, describedBy) => (
                        <SelectControl id={id} aria-describedby={describedBy} aria-label={aria} invalid={!!error} value={text} disabled={disabled} onChange={(e) => onChange(e.target.value || null)}>
                            <option value="">{t('fields.no_selection')}</option>
                            {definition.options.map((option) => (
                                <option key={option} value={option}>
                                    {option}
                                </option>
                            ))}
                            {/* a stored value whose option was removed later stays visible */}
                            {text !== '' && !definition.options.includes(text) && <option value={text}>{text}</option>}
                        </SelectControl>
                    )}
                </Field>
            );
        case 'boolean':
            return (
                <Field label={label} hint={hint} error={error} path={path}>
                    {() => (
                        <Switch className="h-control" checked={value === true} disabled={disabled} aria-label={definition.label} onChange={(e) => onChange(e.target.checked)} label={value === true ? t('fields.yes') : t('fields.no')} />
                    )}
                </Field>
            );
        case 'image':
            // no upload path for images yet (phase 7 brings asset uploads); the stored path stays as it is
            return <TextInput label={label} hint={compact ? undefined : t('fields.image_read_only')} error={error} path={path} value={text} disabled readOnly aria-label={aria} />;
        default:
            return <TextInput label={label} hint={hint} error={error} path={path} value={text} disabled={disabled} aria-label={aria} onChange={(e) => onChange(e.target.value)} />;
    }
}

type DecimalProps = { label?: ReactNode; hint?: ReactNode; error?: string; path?: string; value: string; disabled: boolean; aria?: string; money: boolean; onChange(value: CustomValue): void };

/** Typing keeps the raw text ("12,5"); leaving the field stores "12.5" (or null when empty). */
function DecimalInput({ label, hint, error, path, value, disabled, aria, money, onChange }: DecimalProps) {
    const [raw, setRaw] = useState(value);
    useEffect(() => setRaw(value), [value]);

    return (
        <Field label={label} hint={hint} error={error} path={path}>
            {(id, describedBy) => (
                <span className="relative flex items-center">
                    <input
                        id={id}
                        inputMode="decimal"
                        aria-label={aria}
                        aria-invalid={error ? true : undefined}
                        aria-describedby={describedBy}
                        disabled={disabled}
                        value={raw}
                        onChange={(e) => setRaw(e.target.value)}
                        onBlur={() => onChange(toDecimalString(raw))}
                        onKeyDown={(e) => {
                            // Enter commits the number first instead of submitting the form with the old value
                            if (e.key === 'Enter') {
                                e.preventDefault();
                                e.currentTarget.blur();
                            }
                        }}
                        className={controlClass(!!error, cx('num h-control text-right', money && 'pr-8'))}
                    />
                    {money && <span aria-hidden className="pointer-events-none absolute right-3 text-sm text-muted">€</span>}
                </span>
            )}
        </Field>
    );
}
