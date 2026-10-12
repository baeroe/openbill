import type { Paper } from '@/api/types';
import { Select, TextInput } from '@/components/ui';
import { t } from '@/lib/i18n';
import { DEFAULT_PAPER } from '../editor-state';

/** CSS length as the manifest wants it (App\Rendering\Paper::LENGTH); only a format hint, the server checks the rest. */
const LENGTH = /^\d+(?:\.\d+)?(mm|cm|in|pt|px)$/;

export function PaperForm({ paper, readOnly, onChange }: { paper: Paper | undefined; readOnly: boolean; onChange(patch: Partial<Paper>): void }) {
    const value = { ...DEFAULT_PAPER, ...paper };
    const length = (key: 'headerHeight' | 'footerHeight' | 'marginX', label: string) => (
        <TextInput
            label={label}
            value={value[key]}
            disabled={readOnly}
            className="font-mono"
            error={LENGTH.test(value[key]) ? undefined : t('templates.paper_length_hint')}
            onChange={(e) => onChange({ [key]: e.target.value.trim() })}
        />
    );

    return (
        <div className="grid grid-cols-2 gap-3 px-4 pt-3 pb-4 sm:grid-cols-4">
            <Select label={t('templates.paper_format')} value={value.format} disabled={readOnly} onChange={(e) => onChange({ format: e.target.value })}>
                <option value="A4">A4</option>
                <option value="Letter">Letter</option>
            </Select>
            {length('headerHeight', t('templates.paper_header'))}
            {length('footerHeight', t('templates.paper_footer'))}
            {length('marginX', t('templates.paper_margin'))}
        </div>
    );
}
