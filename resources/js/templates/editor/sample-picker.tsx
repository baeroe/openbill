import type { RenderSources } from '@/api/templates';
import { SelectControl } from '@/components/ui';
import { t } from '@/lib/i18n';
import { parseSource, sourceValue, type SampleSource } from '../scenario';

export function SamplePicker({ sources, value, onChange }: { sources: RenderSources; value: SampleSource; onChange(source: SampleSource): void }) {
    return (
        <label className="flex min-w-0 items-center gap-2 text-sm text-muted">
            <span className="whitespace-nowrap">{t('templates.sample')}</span>
            <SelectControl
                className="w-[16rem] max-w-full"
                value={sourceValue(value)}
                onChange={(e) => {
                    const source = parseSource(e.target.value);
                    if (source) onChange(source);
                }}
            >
                <optgroup label={t('templates.sample_scenarios')}>
                    {sources.scenarios.map((scenario) => (
                        <option key={scenario.key} value={sourceValue({ kind: 'scenario', key: scenario.key })}>
                            {t(`scenario.${scenario.key}`)}
                        </option>
                    ))}
                </optgroup>
                {sources.documents.length > 0 && (
                    <optgroup label={t('templates.sample_documents')}>
                        {sources.documents.map((document) => (
                            <option key={document.id} value={sourceValue({ kind: 'document', id: document.id })}>
                                {`${t(`document_type.${document.type}`)} ${document.number ?? t('templates.sample_draft')} · ${document.customer_name ?? '–'}`}
                            </option>
                        ))}
                    </optgroup>
                )}
            </SelectControl>
        </label>
    );
}
