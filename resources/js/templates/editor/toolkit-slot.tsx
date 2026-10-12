import { Link } from '@inertiajs/react';
import { AlertTriangle, Download, SquareTerminal } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { mutate } from 'swr';
import { keys } from '@/api/keys';
import { Button, Dialog, Notice } from '@/components/ui';
import { apiBlob, errorMessage } from '@/lib/api';
import { saveBlob } from '@/lib/download';
import { path, t } from '@/lib/i18n';
import { toast } from '@/lib/toast';

export type ToolkitSlotProps = {
    templateId: string;
    builtIn: boolean;
    /** Unsaved changes in the editor: the toolkit should start from the saved state. */
    dirty: boolean;
    /** Saves the editor (PUT /api/templates/{id}/files); false when invalid or failed. */
    save(): Promise<boolean>;
};

const code = 'rounded-sm bg-surface-2 px-1 font-mono text-sm';

/**
 * "Toolkit" in the editor header (spec 7): explains the kit, warns about the token it contains and downloads the ZIP
 * (POST /{locale}/templates/{id}/toolkit). Built-in templates get the hint to duplicate first, no download.
 */
export function ToolkitSlot({ templateId, builtIn, dirty, save }: ToolkitSlotProps): ReactNode {
    const [open, setOpen] = useState(false);
    const [pending, setPending] = useState(false);

    const download = async () => {
        setPending(true);
        try {
            if (dirty && !(await save())) return;
            const file = await apiBlob(path(`/templates/${templateId}/toolkit`), { method: 'POST' });
            saveBlob(file.blob, file.filename ?? 'openbill-toolkit.zip');
            void mutate(keys.tokens());
            toast.success(t('toolkit.downloaded'));
            setOpen(false);
        } catch (error) {
            toast.error(errorMessage(error));
        } finally {
            setPending(false);
        }
    };

    const footer = builtIn ? (
        <Button variant="primary" onClick={() => setOpen(false)}>
            {t('common.close')}
        </Button>
    ) : (
        <>
            <Button variant="ghost" disabled={pending} onClick={() => setOpen(false)}>
                {t('common.cancel')}
            </Button>
            <Button variant="primary" icon={<Download />} pending={pending} onClick={() => void download()}>
                {dirty ? t('toolkit.save_and_download') : t('toolkit.download')}
            </Button>
        </>
    );

    return (
        <>
            <Button variant="ghost" icon={<SquareTerminal />} onClick={() => setOpen(true)}>
                {t('toolkit.button')}
            </Button>
            <Dialog open={open} onClose={() => !pending && setOpen(false)} title={t('toolkit.title')} description={t('toolkit.description')} footer={footer} wide>
                {builtIn ? (
                    <Notice tone="warn" icon={<AlertTriangle />}>
                        {t('toolkit.built_in')}
                    </Notice>
                ) : (
                    <>
                        <ol className="m-0 grid list-decimal gap-2 pl-5">
                            <li>
                                {t('toolkit.step_install')} <code className={code}>pnpm install</code> · <code className={code}>pnpm dev</code>
                            </li>
                            <li>{t('toolkit.step_edit')}</li>
                            <li>
                                {t('toolkit.step_push')} <code className={code}>pnpm push</code> · <code className={code}>pnpm pull</code> · <code className={code}>pnpm run pack</code>
                            </li>
                        </ol>
                        <Notice tone="warn" icon={<AlertTriangle />}>
                            <b>{t('toolkit.token_title')}</b> {t('toolkit.token_text')} <Link href={path('/settings/api')} className="font-medium underline underline-offset-2">{t('toolkit.token_link')}</Link>
                        </Notice>
                        {dirty && <Notice>{t('toolkit.unsaved')}</Notice>}
                        <p className="m-0 text-sm text-muted">{t('toolkit.requirements')}</p>
                    </>
                )}
            </Dialog>
        </>
    );
}
