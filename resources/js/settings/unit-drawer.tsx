import { useState } from 'react';
import { saveUnit, type UnitInput } from '@/api/settings';
import { Button, Drawer, Select, TextInput } from '@/components/ui';
import { ApiError, errorMessage } from '@/lib/api';
import { t } from '@/lib/i18n';
import { toast } from '@/lib/toast';
import { UNIT_CODES } from './unit-codes';

export function UnitDrawer({ initial, id, onClose }: { initial: UnitInput; id?: string; onClose(): void }) {
    const [unit, setUnit] = useState(initial);
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [pending, setPending] = useState(false);

    const submit = async () => {
        setPending(true);
        try {
            const saved = await saveUnit(unit, id);
            toast.success(t('settings.unit_saved', { name: saved.name }));
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
            title={id ? t('settings.unit_edit') : t('settings.unit_new')}
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
                <div className="grid gap-4 sm:grid-cols-2">
                    <TextInput label={t('settings.unit_name')} value={unit.name} data-autofocus placeholder={t('settings.unit_name_placeholder')} error={errors.name} onChange={(e) => setUnit({ ...unit, name: e.target.value })} />
                    <TextInput label={t('settings.unit_symbol')} value={unit.symbol} placeholder={t('settings.unit_symbol_placeholder')} error={errors.symbol} onChange={(e) => setUnit({ ...unit, symbol: e.target.value })} />
                </div>
                <TextInput
                    label={t('settings.unit_decimals')}
                    type="number"
                    min={0}
                    max={4}
                    value={unit.decimals}
                    error={errors.decimals}
                    onChange={(e) => setUnit({ ...unit, decimals: Math.min(4, Math.max(0, Math.trunc(Number(e.target.value)))) })}
                />
                <Select label={t('settings.unit_code')} hint={t('settings.unit_code_hint')} value={unit.code} error={errors.code} onChange={(e) => setUnit({ ...unit, code: e.target.value })}>
                    <option value="">{t('settings.unit_no_code')}</option>
                    {UNIT_CODES.map((code) => (
                        <option key={code} value={code}>
                            {code}: {t(`unit_code.${code}`)}
                        </option>
                    ))}
                    {unit.code && !(UNIT_CODES as readonly string[]).includes(unit.code) && <option value={unit.code}>{unit.code}</option>}
                </Select>
            </form>
        </Drawer>
    );
}
