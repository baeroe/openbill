import { Link } from '@inertiajs/react';
import { AlertCircle, ArrowUpRight, CheckCircle2, ChevronRight } from 'lucide-react';
import type { ComplianceProfile, Issue } from '@/api/types';
import { cx } from '@/components/ui';
import { path, t, tn } from '@/lib/i18n';

const ITEM = 'flex w-full items-center gap-2 rounded-sm bg-[color-mix(in_srgb,var(--surface)_55%,transparent)] px-3 py-[7px] text-left text-sm text-ink no-underline hover:bg-surface [&>svg]:ml-auto [&>svg]:size-[0.95rem] [&>svg]:shrink-0 [&>svg]:text-muted';
const WHERE = 'ml-auto inline-flex items-center gap-1 text-xs whitespace-nowrap text-muted [&_svg]:size-3';

/** Result of the compliance profile from the last render answer, every issue jumps to its field or links to its place. */
export function CompliancePanel({ issues, profile, customerId, onJump }: { issues: Issue[]; profile: ComplianceProfile; customerId: string | null; onJump(path: string): void }) {
    const ok = issues.length === 0;
    return (
        <section id="check-panel" aria-live="polite" className={cx('grid scroll-mt-16 gap-3 rounded-lg px-5 py-4', ok ? 'bg-ok-soft text-ok' : 'bg-warn-soft text-warn')}>
            <div className="flex items-center gap-3">
                {ok ? <CheckCircle2 aria-hidden className="size-5 shrink-0" /> : <AlertCircle aria-hidden className="size-5 shrink-0" />}
                <div className="grid">
                    <b className="font-strong">{ok ? t('editor.check.ready') : tn('editor.check.missing', issues.length)}</b>
                    <span className="text-xs opacity-80">{t('editor.check.profile', { profile: profile === 'en16931' ? t('editor.profile.en16931') : t('editor.profile.basic') })}</span>
                </div>
            </div>
            {!ok && (
                <ul className="m-0 grid list-none gap-0.5 p-0">
                    {issues.map((issue) => (
                        <li key={`${issue.path}:${issue.code}`}>
                            {(issue.path.startsWith('customer.') || issue.path.startsWith('contact.')) && customerId ? (
                                <Link href={path(`/customers/${customerId}`)} className={ITEM}>
                                    {issue.message}
                                    <span className={WHERE}>
                                        {t('editor.check.at_customer')}
                                        <ArrowUpRight aria-hidden />
                                    </span>
                                </Link>
                            ) : issue.path.startsWith('org.') ? (
                                <Link href={path(`/settings/organization?focus=${encodeURIComponent(issue.path)}`)} className={ITEM}>
                                    {issue.message}
                                    <span className={WHERE}>
                                        {t('editor.check.org')}
                                        <ArrowUpRight aria-hidden />
                                    </span>
                                </Link>
                            ) : (
                                <button type="button" className={ITEM} onClick={() => onJump(issue.path)}>
                                    {issue.message}
                                    <ChevronRight aria-hidden />
                                </button>
                            )}
                        </li>
                    ))}
                </ul>
            )}
        </section>
    );
}
