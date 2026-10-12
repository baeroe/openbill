import { ImagePlus, Trash2 } from 'lucide-react';
import { useRef, useState, type ReactNode } from 'react';
import { uploadImage, uploadUrl } from '@/api/fields';
import { Button, Field } from '@/components/ui';
import { t } from '@/lib/i18n';
import { toast } from '@/lib/toast';
import { uploadError } from '@/templates/import-button';

type Props = { label?: ReactNode; hint?: ReactNode; error?: string; path?: string; value: string | null; disabled: boolean; compact?: boolean; aria?: string; onChange(value: string | null): void };

/** Image field: upload (POST /api/uploads) → the stored path is the value; shown through GET /api/uploads/{name}. */
export function ImageFieldInput({ label, hint, error, path, value, disabled, compact = false, aria, onChange }: Props) {
    const input = useRef<HTMLInputElement>(null);
    const [pending, setPending] = useState(false);

    const onFile = async (file: File | undefined) => {
        if (!file) return;
        setPending(true);
        try {
            onChange((await uploadImage(file)).path);
        } catch (e) {
            toast.error(uploadError(e));
        } finally {
            setPending(false);
        }
    };

    const picker = (
        <input
            ref={input}
            type="file"
            accept="image/png,image/jpeg,image/gif,image/webp,image/svg+xml"
            hidden
            onChange={(e) => {
                void onFile(e.target.files?.[0]);
                e.target.value = '';
            }}
        />
    );

    return (
        <Field label={label} hint={hint ?? (compact ? undefined : t('fields.image_hint'))} error={error} path={path}>
            {() => (
                <div className="flex min-w-0 items-center gap-2">
                    {picker}
                    {value && <img src={uploadUrl(value)} alt="" className={compact ? 'size-8 rounded-sm bg-surface-2 object-contain' : 'size-14 rounded-md bg-surface-2 object-contain p-1'} />}
                    <Button size="sm" variant="default" icon={<ImagePlus />} iconOnly={compact} pending={pending} disabled={disabled} aria-label={aria} onClick={() => input.current?.click()}>
                        {value ? t('fields.image_replace') : t('fields.image_upload')}
                    </Button>
                    {value && (
                        <Button size="sm" variant="ghost" iconOnly icon={<Trash2 />} disabled={disabled} onClick={() => onChange(null)}>
                            {t('fields.image_remove')}
                        </Button>
                    )}
                </div>
            )}
        </Field>
    );
}
