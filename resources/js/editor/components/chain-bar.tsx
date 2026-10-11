import { Link } from '@inertiajs/react';
import { ChevronRight } from 'lucide-react';
import type { DocumentPageContext } from '@/api/types';
import { cx } from '@/components/ui';
import { path, t } from '@/lib/i18n';

/** Offer → order confirmation → invoice → cancellation; the server builds the chain (DocumentChain). */
export function ChainBar({ chain, currentId }: { chain: DocumentPageContext['chain']; currentId: string }) {
    if (chain.length < 2) return null;
    return (
        <nav aria-label={t('editor.chain')} className="-mt-6 flex flex-wrap items-center gap-0.5">
            {chain.map((member, i) => (
                <span key={member.id} className="inline-flex items-center gap-0.5">
                    {i > 0 && <ChevronRight aria-hidden className="size-3.5 text-faint" />}
                    <Link
                        href={path(`/documents/${member.id}`)}
                        aria-current={member.id === currentId ? 'page' : undefined}
                        title={`${t(`document_type.${member.type}`)}, ${t(`status.${member.status}`)}`}
                        className={cx(
                            'inline-flex h-7 items-center gap-1.5 rounded-full px-3 text-xs font-medium no-underline transition-colors',
                            member.id === currentId ? 'bg-accent-soft text-accent' : 'bg-surface-2 text-muted hover:bg-surface-3 hover:text-ink',
                        )}
                    >
                        {t(`document_type.${member.type}`)} <span className="num">{member.number ?? t('documents.draft')}</span>
                    </Link>
                </span>
            ))}
        </nav>
    );
}
