import { useState } from 'react';
import { saveTaxRate, type TaxRateInput } from '@/api/settings';
import { Button, Drawer, Select, Textarea, TextInput } from '@/components/ui';
import { ApiError, errorMessage } from '@/lib/api';
import { toDecimalString } from '@/lib/format';
import { t } from '@/lib/i18n';
import { toast } from '@/lib/toast';

/** EN 16931 VAT categories (App\Enums\TaxCategory); labels tax_category.<code>. */
export const TAX_CATEGORIES = ['S', 'Z', 'E', 'AE', 'K', 'G'];

export function TaxRateDrawer({ initial, id, onClose }: { initial: TaxRateInput; id?: string; onClose(): void }) {
    const [rate, setRate] = useState(initial);
    const [percent, setPercent] = useState(initial.percent);
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [pending, setPending] = useState(false);

    const submit = async () => {
        setPending(true);
        try {
            const saved = await saveTaxRate({ ...rate, percent: toDecimalString(percent) ?? percent, exemption_note: rate.exemption_note?.trim() || null }, id);
            toast.success(t('settings.rate_saved', { label: saved.label }));
            onClose();
        } catch (error) {
            if (error instanceof ApiError && error.status === 422) setErrors(error.fieldErrors());
            else toast.error(errorMessage(error));
        } finally {
            setPending(false);
        }
    };

    return (
        <Drawer
            open
            onClose={onClose}
            title={id ? t('settings.rate_edit') : t('settings.rate_new')}
            footer={
                <>
                    <Button variant="ghost" onClick={onClose}>
                        {t('common.cancel')}
                    </Button>
                    <Button variant="primary" pending={pending} onClick={() => void submit()}>
                        {t('settings.save')}
                    </Button>
                </>
            }
        >
            <form
                noValidate
                className="grid gap-4"
                onSubmit={(e) => {
                    e.preventDefault();
                    void submit();
                }}
            >
                <TextInput label={t('settings.rate_label')} value={rate.label} data-autofocus placeholder={t('settings.rate_label_placeholder')} error={errors.label} onChange={(e) => setRate({ ...rate, label: e.target.value })} />
                <TextInput label={t('settings.rate_percent')} inputMode="decimal" value={percent} className="num" aside={<span className="text-xs">%</span>} error={errors.percent} onChange={(e) => setPercent(e.target.value)} />
                <Select label={t('settings.rate_category')} value={rate.category} error={errors.category} onChange={(e) => setRate({ ...rate, category: e.target.value })}>
                    {TAX_CATEGORIES.map((category) => (
                        <option key={category} value={category}>
                            {category}: {t(`tax_category.${category}`)}
                        </option>
                    ))}
                </Select>
                <Textarea
                    label={t('settings.rate_note')}
                    rows={2}
                    value={rate.exemption_note ?? ''}
                    hint={t('settings.rate_note_hint')}
                    error={errors.exemption_note}
                    onChange={(e) => setRate({ ...rate, exemption_note: e.target.value })}
                />
            </form>
        </Drawer>
    );
}
