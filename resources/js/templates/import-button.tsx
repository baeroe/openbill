import { router } from '@inertiajs/react';
import { Upload } from 'lucide-react';
import { useRef, useState } from 'react';
import { importTemplate } from '@/api/templates';
import { Button, type ButtonVariant } from '@/components/ui';
import { ApiError, errorMessage } from '@/lib/api';
import { path, t } from '@/lib/i18n';
import { toast } from '@/lib/toast';

/** First violation of a 422 (the package or manifest problem), otherwise the general message. */
export function uploadError(error: unknown): string {
    return error instanceof ApiError && error.violations[0] ? error.violations[0].message : errorMessage(error);
}

/** "Import ZIP": file picker → POST /api/templates (multipart "package") → toast with "Open". */
export function ImportButton({ variant = 'primary' }: { variant?: ButtonVariant }) {
    const input = useRef<HTMLInputElement>(null);
    const [pending, setPending] = useState(false);

    const onFile = async (file: File | undefined) => {
        if (!file) return;
        setPending(true);
        try {
            const template = await importTemplate(file);
            toast.success(t('templates.imported', { name: template.name }), { label: t('templates.open'), run: () => router.visit(path(`/templates/${template.id}`)) });
        } catch (error) {
            toast.error(uploadError(error));
        } finally {
            setPending(false);
        }
    };

    return (
        <>
            <input
                ref={input}
                type="file"
                accept=".zip,application/zip"
                hidden
                onChange={(e) => {
                    void onFile(e.target.files?.[0]);
                    e.target.value = '';
                }}
            />
            <Button variant={variant} icon={<Upload />} pending={pending} onClick={() => input.current?.click()}>
                {t('templates.import')}
            </Button>
        </>
    );
}
