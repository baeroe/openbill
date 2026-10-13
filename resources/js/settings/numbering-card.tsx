import type { NumberPreview, NumberingInput } from '@/api/settings';
import { CardHead, Checkbox, TextInput } from '@/components/ui';
import { t } from '@/lib/i18n';
import { SettingsCard } from './settings-card';

const PLACEHOLDERS = ['{YYYY}', '{YY}', '{MM}', '{0000}'] as const;
const PLACEHOLDER_KEYS: Record<(typeof PLACEHOLDERS)[number], string> = { '{YYYY}': 'year_long', '{YY}': 'year_short', '{MM}': 'month', '{0000}': 'sequence' };

type Props = {
    id: string;
    title: string;
    description: string;
    value: NumberingInput;
    /** Field errors: pattern, next_value. */
    errors: { pattern?: string; next_value?: string };
    preview: NumberPreview | undefined;
    onChange: (patch: Partial<NumberingInput>) => void;
};

/** Pattern with placeholder chips, yearly reset, next value and the next number from the server (document types, customers). */
export function NumberingCard({ id, title, description, value, errors, preview, onChange }: Props) {
    return (
        <SettingsCard aria-labelledby={id}>
            <CardHead titleId={id} title={title} description={description} />
            <div className="grid items-start gap-5 sm:grid-cols-[minmax(0,1fr)_15rem]">
                <div className="grid gap-4">
                    <TextInput label={t('settings.pattern')} value={value.pattern} className="font-mono" error={errors.pattern} onChange={(e) => onChange({ pattern: e.target.value })} />
                    <div className="flex flex-wrap gap-1.5" aria-label={t('settings.placeholders')}>
                        {PLACEHOLDERS.map((token) => (
                            <button
                                key={token}
                                type="button"
                                onClick={() => onChange({ pattern: value.pattern + token })}
                                className="inline-flex h-[1.875rem] items-center gap-2 rounded-full bg-surface px-3 text-xs text-muted transition-colors hover:bg-accent-soft hover:text-accent"
                            >
                                <code className="font-mono text-ink">{token}</code>
                                <span>{t(`settings.placeholder.${PLACEHOLDER_KEYS[token]}`)}</span>
                            </button>
                        ))}
                    </div>
                    <Checkbox label={t('settings.reset_yearly')} checked={value.reset_yearly} onChange={(e) => onChange({ reset_yearly: e.target.checked })} />
                    <TextInput
                        label={t('settings.next_value')}
                        type="number"
                        min={1}
                        inputMode="numeric"
                        value={value.next_value ?? ''}
                        error={errors.next_value}
                        hint={t('settings.next_value_hint')}
                        onChange={(e) => onChange({ next_value: e.target.value === '' ? undefined : Math.max(1, Math.trunc(Number(e.target.value))) })}
                    />
                </div>
                <div aria-live="polite" className="grid gap-1 rounded-lg bg-accent-soft p-5">
                    <span className="text-sm text-muted">{t('settings.next_number')}</span>
                    <strong className="num text-2xl font-bold tracking-brand break-all text-accent">{preview?.valid ? preview.number : '–'}</strong>
                    {preview?.message && <span className={preview.valid ? 'text-xs text-muted' : 'text-xs text-bad'}>{preview.message}</span>}
                </div>
            </div>
        </SettingsCard>
    );
}
