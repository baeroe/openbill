import { Link } from '@inertiajs/react';
import { ChevronDown, Lock } from 'lucide-react';
import { useState } from 'react';
import { useDocumentTypes } from '@/api/settings';
import { useRenderSchema } from '@/api/templates';
import type { FieldScope } from '@/api/types';
import { Badge, cx } from '@/components/ui';
import { path, t, tn } from '@/lib/i18n';
import { liquidPath } from './expression';
import { PROFILE_REQUIREMENTS } from './profile-requirements';

/** Locked core fields and e-invoice requirements of a level, folded by default. */
export function BuiltInFields({ scope }: { scope: FieldScope }) {
    const [open, setOpen] = useState(false);
    const schema = useRenderSchema();
    const documentTypes = useDocumentTypes();
    const core = schema.data?.levels[scope].core ?? [];
    const requirements = PROFILE_REQUIREMENTS[scope] ?? [];
    const einvoiceTypes = (documentTypes.data ?? []).filter((setting) => setting.profile === 'en16931').map((setting) => t(`document_type.${setting.type}`));

    return (
        <section className="rounded-lg bg-surface-2">
            <button type="button" aria-expanded={open} onClick={() => setOpen(!open)} className="flex w-full items-center gap-3 rounded-lg px-5 py-4 text-left">
                <Lock aria-hidden className="size-4 shrink-0 text-muted" />
                <span>
                    <b className="font-strong">{t('fields.built_in')}</b>{' '}
                    <span className="text-muted">
                        {tn('fields.core_count', core.length)}
                        {requirements.length > 0 && `, ${tn('fields.profile_count', requirements.length)}`}
                    </span>
                </span>
                <ChevronDown aria-hidden className={cx('ml-auto size-4 transition-transform', open && 'rotate-180')} />
            </button>
            {open && (
                <div className="grid gap-4 px-5 pb-5">
                    <p className="text-muted">{t('fields.built_in_text')}</p>
                    <div className="grid grid-cols-[repeat(auto-fill,minmax(14rem,1fr))] gap-2">
                        {core.map((key) => (
                            <div key={key} className="flex min-w-0 items-center justify-between gap-2 rounded-md bg-surface px-3 py-2 text-sm">
                                <code className="truncate font-mono text-xs">{liquidPath(scope, key)}</code>
                                <Lock aria-hidden className="size-3.5 shrink-0 text-faint" />
                            </div>
                        ))}
                    </div>
                    {requirements.length > 0 && (
                        <div className="grid gap-2">
                            <div className="flex flex-wrap items-center gap-2">
                                <Badge tone="accent">{t('fields.einvoice')}</Badge>
                                <span className="text-muted">
                                    {einvoiceTypes.length > 0 ? (
                                        t('fields.einvoice_active', { types: einvoiceTypes.join(', ') })
                                    ) : (
                                        <>
                                            {t('fields.einvoice_inactive')} <Link href={path('/settings/document-types')}>{t('fields.einvoice_settings')}</Link>
                                        </>
                                    )}
                                </span>
                            </div>
                            <div className="grid grid-cols-[repeat(auto-fill,minmax(14rem,1fr))] gap-2">
                                {requirements.map((item) => (
                                    <div key={item} className="flex min-w-0 items-center justify-between gap-2 rounded-md bg-surface px-3 py-2 text-sm">
                                        <span className="truncate">{t(`fields.profile.${item}`)}</span>
                                        <Lock aria-hidden className="size-3.5 shrink-0 text-faint" />
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </section>
    );
}
