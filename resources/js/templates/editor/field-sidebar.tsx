import { PanelLeftClose } from 'lucide-react';
import type { RenderSchema } from '@/api/templates';
import type { FieldScope } from '@/api/types';
import { Button, Skeleton, cx } from '@/components/ui';
import { expression, liquidPath, SNIPPETS } from '@/fields/expression';
import { t } from '@/lib/i18n';

const SCOPES: FieldScope[] = ['org', 'customer', 'contact', 'document', 'position'];
const ITEM = 'grid w-full grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-2 gap-y-0.5 rounded-sm px-2 py-1.5 text-left text-sm text-ink transition-colors enabled:hover:bg-bg disabled:cursor-default';

/** "Available fields": core and custom fields per level; a click inserts the expression at the cursor. */
export function FieldSidebar({ schema, disabledReason, onInsert, onClose }: { schema: RenderSchema | undefined; disabledReason: string | null; onInsert(code: string): void; onClose(): void }) {
    const disabled = disabledReason !== null;

    return (
        <section aria-label={t('templates.fields')} className="grid min-h-0 grid-rows-[auto_minmax(0,1fr)] overflow-hidden rounded-lg bg-surface-2">
            <div className="flex items-center gap-2 p-3">
                <span className="pl-2 text-sm font-strong">{t('templates.fields')}</span>
                <span className="flex-1" />
                <Button size="sm" variant="ghost" iconOnly icon={<PanelLeftClose />} onClick={onClose}>
                    {t('templates.fields_close')}
                </Button>
            </div>
            <div className="grid max-h-80 content-start gap-4 overflow-auto px-3 pb-4 lg:max-h-none">
                {disabledReason && <p className="px-2 text-xs text-muted">{disabledReason}</p>}
                {!schema ? (
                    <Skeleton h={240} />
                ) : (
                    SCOPES.map((scope) => {
                        const level = schema.levels[scope];
                        return (
                            <div key={scope} className="grid gap-0.5">
                                <div className="flex items-baseline gap-2 px-2 pb-1 text-sm font-strong">
                                    {t(`fields.scope.${scope}`)}
                                    <code className="rounded-sm bg-bg px-1 font-mono text-xs font-normal text-muted">{level.context}</code>
                                </div>
                                {level.custom.map((field) => (
                                    <button key={field.key} type="button" disabled={disabled} className={ITEM} onClick={() => onInsert(expression(scope, field.key, field.type))} title={expression(scope, field.key, field.type)}>
                                        <span className="min-w-0 truncate after:ml-1.5 after:inline-block after:size-1.5 after:rounded-full after:bg-accent after:align-middle after:content-['']">{field.label}</span>
                                        <span className="text-xs text-muted">{t(`fields.type.${field.type}`)}</span>
                                        <span className="col-span-2 truncate font-mono text-[11px] text-muted">{liquidPath(scope, field.key)}</span>
                                    </button>
                                ))}
                                {level.core.map((key) => (
                                    <button key={key} type="button" disabled={disabled} className={cx(ITEM, 'py-1')} onClick={() => onInsert(expression(scope, key))} title={expression(scope, key)}>
                                        <span className="col-span-2 truncate font-mono text-xs">{liquidPath(scope, key)}</span>
                                    </button>
                                ))}
                            </div>
                        );
                    })
                )}
                <div className="grid gap-2 rounded-md bg-bg p-3 text-xs text-muted">
                    <span>{t('templates.snippets')}</span>
                    {SNIPPETS.map((snippet) => (
                        <button key={snippet.key} type="button" disabled={disabled} className="justify-self-start text-left font-mono text-ink enabled:hover:text-accent" onClick={() => onInsert(snippet.code)} title={snippet.code}>
                            {t(`templates.snippet.${snippet.key}`)}
                        </button>
                    ))}
                    <span>{t('templates.filters_hint')}</span>
                    <span>{t('templates.custom_dot_hint')}</span>
                </div>
            </div>
        </section>
    );
}
