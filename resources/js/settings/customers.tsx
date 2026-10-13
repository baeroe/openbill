import { useState } from 'react';
import { saveCustomerNumbering, useCustomerNumbering, useCustomerNumberPreview, type CustomerNumbering, type NumberingInput } from '@/api/settings';
import { ErrorState, Skeleton } from '@/components/ui';
import { ApiError, errorMessage } from '@/lib/api';
import { useLeaveGuard } from '@/lib/hooks';
import { t } from '@/lib/i18n';
import { toast } from '@/lib/toast';
import { NumberingCard } from './numbering-card';
import { SaveBar } from './save-bar';

/** Settings section "customers": the number range of new customers. */
export function CustomerSettings() {
    const numbering = useCustomerNumbering();

    if (numbering.error) return <ErrorState error={numbering.error} onRetry={() => void numbering.mutate()} />;
    if (!numbering.data) return <Skeleton h={360} r={18} />;

    return <CustomerNumberingForm key={JSON.stringify(numbering.data)} saved={numbering.data} />;
}

const inputOf = (saved: CustomerNumbering): NumberingInput => ({ pattern: saved.pattern, reset_yearly: saved.reset_yearly, next_value: saved.next_value });

function CustomerNumberingForm({ saved }: { saved: CustomerNumbering }) {
    const [form, setForm] = useState<NumberingInput>(() => inputOf(saved));
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [pending, setPending] = useState(false);
    const preview = useCustomerNumberPreview(form.pattern, form.reset_yearly, form.next_value ?? null);
    const dirty = JSON.stringify(form) !== JSON.stringify(inputOf(saved));
    const releaseGuard = useLeaveGuard(dirty, t('settings.leave_confirm'));

    const submit = async () => {
        setPending(true);
        try {
            // send next_value only when it was changed: the counter may have moved since the page loaded
            await saveCustomerNumbering(form.next_value === saved.next_value ? { pattern: form.pattern, reset_yearly: form.reset_yearly } : form);
            releaseGuard();
            setErrors({});
            toast.success(t('settings.customer_numbering_saved'));
        } catch (error) {
            if (error instanceof ApiError && error.status === 422) setErrors(error.fieldErrors());
            toast.error(errorMessage(error));
        } finally {
            setPending(false);
        }
    };

    return (
        <form
            noValidate
            className="grid gap-6"
            onSubmit={(e) => {
                e.preventDefault();
                void submit();
            }}
        >
            <NumberingCard
                id="customer-numbering"
                title={t('settings.customer_numbering')}
                description={t('settings.customer_numbering_text')}
                value={form}
                errors={{ pattern: errors.pattern, next_value: errors.next_value }}
                preview={preview.data}
                onChange={(patch) => setForm((current) => ({ ...current, ...patch }))}
            />
            <SaveBar dirty={dirty} pending={pending} onReset={() => setForm(inputOf(saved))} />
        </form>
    );
}
