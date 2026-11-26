import { Download } from 'lucide-react';
import { keys } from '@/api/keys';
import type { DocumentDetail, FrozenAttachment } from '@/api/types';
import { AttachmentPicker } from '@/components/attachment-picker';
import { buttonClass } from '@/components/ui';
import { t } from '@/lib/i18n';
import type { Draft } from '../types';

type Props = {
    draft: Draft;
    document: DocumentDetail;
    readOnly: boolean;
    messages: Record<string, string>;
    update(fn: (draft: Draft) => Draft): void;
};

/**
 * Attachments of a quote or confirmation. Draft: short names (chips). Finalized: the versions frozen at that moment, each
 * with the download of its own PDF – a later version of the text never changes them.
 */
export function AttachmentsSection({ draft, document, readOnly, messages, update }: Props) {
    const frozen = document.is_locked ? ((document.attachments ?? []) as FrozenAttachment[]) : null;

    return (
        <section className="grid min-w-0 gap-3" aria-labelledby="attachments-heading" data-path="document.attachments">
            <div>
                <h2 id="attachments-heading" className="text-lg font-heading">
                    {t('attachments.title')}
                </h2>
                <p className="mt-0.5 text-sm text-muted">{frozen ? t('attachments.frozen_text') : t('attachments.text')}</p>
            </div>
            {frozen ? (
                frozen.length === 0 ? (
                    <p className="text-sm text-muted">{t('attachments.none')}</p>
                ) : (
                    <ul className="m-0 grid list-none gap-2 p-0">
                        {frozen.map((item) => (
                            <li key={item.document_id} className="flex flex-wrap items-center gap-3 rounded-lg bg-surface-2 px-4 py-3">
                                <span className="grid min-w-0">
                                    <span className="font-strong">{item.title}</span>
                                    <span className="text-xs text-muted">{`${item.slug} · ${item.number}`}</span>
                                </span>
                                <span className="flex-1" />
                                <a href={keys.documentPdfDownload(item.document_id)} download className={buttonClass({ size: 'sm' })}>
                                    <Download aria-hidden />
                                    {t('attachments.download')}
                                </a>
                            </li>
                        ))}
                    </ul>
                )
            ) : (
                <AttachmentPicker value={draft.attachments ?? []} disabled={readOnly} messages={messages} pathPrefix="document.attachments" onChange={(attachments) => update((d) => ({ ...d, attachments }))} />
            )}
        </section>
    );
}
