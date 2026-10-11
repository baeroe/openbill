import { Copy, Download, FileCode } from 'lucide-react';
import useSWR from 'swr';
import { fetchXml } from '@/api/documents';
import { keys } from '@/api/keys';
import { Button, buttonClass, ErrorState, Notice, Skeleton } from '@/components/ui';
import { t } from '@/lib/i18n';
import { toast } from '@/lib/toast';

/** E-invoice tab: the archived XML of a finalized document; drafts get it when finalizing. */
export function XmlView({ documentId, finalized }: { documentId: string; finalized: boolean }) {
    const xml = useSWR(finalized ? keys.documentXml(documentId) : null, () => fetchXml(documentId), { revalidateOnFocus: false });

    if (!finalized) return <Notice icon={<FileCode />}>{t('editor.xml_hint_draft')}</Notice>;
    if (xml.error) return <ErrorState error={xml.error} onRetry={() => void xml.mutate()} />;
    if (!xml.data) return <Skeleton h={320} r={12} />;

    const text = xml.data;
    const copy = () => {
        if (!navigator.clipboard) {
            toast.error(t('editor.xml_copy_failed'));
            return;
        }
        navigator.clipboard.writeText(text).then(
            () => toast.success(t('editor.xml_copied')),
            () => toast.error(t('editor.xml_copy_failed')),
        );
    };

    return (
        <div className="overflow-hidden rounded-md bg-surface">
            <div className="flex flex-wrap items-center gap-2 py-2 pr-2 pl-4 text-xs text-muted">
                <span className="flex-1">{t('editor.xml_hint')}</span>
                <Button size="sm" variant="ghost" icon={<Copy />} onClick={copy}>
                    {t('editor.xml_copy')}
                </Button>
                <a className={buttonClass({ variant: 'ghost', size: 'sm' })} href={keys.documentXml(documentId)} download>
                    <Download aria-hidden />
                    {t('editor.xml_download')}
                </a>
            </div>
            <pre tabIndex={0} className="m-0 max-h-[70vh] overflow-auto bg-surface p-4 font-[family-name:var(--font-code)] text-[11px] leading-relaxed text-muted">
                {text}
            </pre>
        </div>
    );
}
