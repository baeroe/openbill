import { Paperclip, X } from 'lucide-react';
import { useTextDocumentSlugs } from '@/api/master-data';
import { Select, Tag } from '@/components/ui';
import { addAttachment, removeAttachment } from '@/editor/ops';
import { t } from '@/lib/i18n';

type Props = {
    value: string[];
    onChange(next: string[]): void;
    disabled?: boolean;
    /** data-path → message; the chip of index i is "<pathPrefix>.<i>" (issue paths of the editor). */
    messages?: Record<string, string>;
    pathPrefix?: string;
};

/**
 * Short names of text documents as chips, added from the newest finalized version of each (text documents without
 * customer). The version itself is chosen when the document is finalized; the chip shows the one that is newest now.
 */
export function AttachmentPicker({ value, onChange, disabled = false, messages = {}, pathPrefix }: Props) {
    const slugs = useTextDocumentSlugs().data ?? [];
    const free = slugs.filter((item) => !value.includes(item.slug));

    return (
        <div className="grid gap-3">
            {value.length > 0 && (
                <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
                    {value.map((slug, index) => {
                        const known = slugs.find((item) => item.slug === slug);
                        const message = pathPrefix ? messages[`${pathPrefix}.${index}`] : undefined;
                        return (
                            <li key={slug} data-path={pathPrefix ? `${pathPrefix}.${index}` : undefined} className="grid gap-1">
                                <span className="inline-flex items-center gap-2 rounded-full bg-surface-2 py-1 pr-1 pl-3 text-sm">
                                    <Paperclip aria-hidden className="size-3.5 text-muted" />
                                    <span className="font-strong">{slug}</span>
                                    <span className="text-muted">{known ? `${known.title} · ${known.number}` : t('attachments.unknown')}</span>
                                    {!disabled && (
                                        <button
                                            type="button"
                                            aria-label={t('attachments.remove', { slug })}
                                            onClick={() => onChange(removeAttachment(value, slug))}
                                            className="grid size-6 place-items-center rounded-full text-muted hover:bg-surface-3 hover:text-ink"
                                        >
                                            <X aria-hidden className="size-3.5" />
                                        </button>
                                    )}
                                </span>
                                {message && <span className="text-xs text-bad">{message}</span>}
                            </li>
                        );
                    })}
                </ul>
            )}
            {value.length === 0 && disabled && <Tag neutral>{t('attachments.none')}</Tag>}
            {!disabled && (
                <Select
                    label={t('attachments.add')}
                    value=""
                    disabled={free.length === 0 || value.length >= 10}
                    wrapClassName="max-w-sm"
                    hint={slugs.length === 0 ? t('attachments.no_texts') : undefined}
                    onChange={(e) => e.target.value && onChange(addAttachment(value, e.target.value))}
                >
                    <option value="">{t('attachments.choose')}</option>
                    {free.map((item) => (
                        <option key={item.slug} value={item.slug}>
                            {`${item.slug} – ${item.title} (${item.number})`}
                        </option>
                    ))}
                </Select>
            )}
        </div>
    );
}
