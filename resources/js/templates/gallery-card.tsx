import { Link, router } from '@inertiajs/react';
import { PagedPreview } from '@openbill/paged-preview';
import { Copy, Eye, MoreHorizontal, Pencil, Trash2 } from 'lucide-react';
import { useState } from 'react';
import useSWR from 'swr';
import type { DocumentTypeSetting } from '@/api/settings';
import { deleteTemplate, duplicateTemplate, renderTemplate, type TemplateSummary } from '@/api/templates';
import type { RenderResponse } from '@/api/types';
import { Badge, Button, ButtonLink, ConfirmDialog, Menu, MenuItem, Skeleton, Tag } from '@/components/ui';
import { errorMessage } from '@/lib/api';
import { path, t } from '@/lib/i18n';
import { toast } from '@/lib/toast';
import { useInView } from '@/lib/use-in-view';
import { previewScenario } from './scenario';

/** One template: thumbnail (rendered on the server once visible), name, types, actions. */
export function GalleryCard({ template, documentTypes }: { template: TemplateSummary; documentTypes: DocumentTypeSetting[] }) {
    const href = path(`/templates/${template.id}`);
    const [confirm, setConfirm] = useState(false);
    const [busy, setBusy] = useState<'duplicate' | 'delete' | null>(null);
    const defaultFor = documentTypes.filter((setting) => setting.template_id === template.id).map((setting) => setting.type);

    const duplicate = async () => {
        setBusy('duplicate');
        try {
            const copy = await duplicateTemplate(template.id);
            toast.success(t('templates.duplicated', { name: copy.name }), { label: t('templates.edit'), run: () => router.visit(path(`/templates/${copy.id}`)) });
        } catch (error) {
            toast.error(errorMessage(error));
        } finally {
            setBusy(null);
        }
    };

    const remove = async () => {
        setBusy('delete');
        try {
            await deleteTemplate(template.id);
            setConfirm(false);
            toast.success(t('templates.deleted', { name: template.name }));
        } catch (error) {
            setConfirm(false);
            toast.error(errorMessage(error));
        } finally {
            setBusy(null);
        }
    };

    return (
        <article className="grid min-w-0 grid-rows-[auto_1fr] overflow-hidden rounded-lg bg-bg">
            <Link
                href={href}
                aria-label={t(template.built_in ? 'templates.view_named' : 'templates.edit_named', { name: template.name })}
                className="block h-60 overflow-hidden bg-surface-2 px-8 pt-6 text-inherit no-underline transition-colors hover:bg-surface-3"
            >
                <Thumbnail template={template} />
            </Link>
            <div className="grid content-start gap-3 px-5 pt-4 pb-5">
                <div className="flex min-w-0 items-center gap-2">
                    <h2 className="min-w-0 truncate text-lg">{template.name}</h2>
                    {template.built_in && <Badge plain>{t('templates.built_in')}</Badge>}
                    <span className="flex-1" />
                    <span className="num text-xs text-muted">v{template.version}</span>
                </div>
                {template.description && <p className="text-sm text-muted">{template.description}</p>}
                <div className="flex flex-wrap gap-1.5" aria-label={t('templates.document_types')}>
                    {template.document_types.map((type) => (
                        <Tag key={type} neutral={!defaultFor.includes(type)}>
                            {t(`document_type.${type}`)}
                            {defaultFor.includes(type) && ` · ${t('templates.default')}`}
                        </Tag>
                    ))}
                </div>
                <div className="mt-1 flex items-center gap-2">
                    <ButtonLink href={href} size="sm" variant={template.built_in ? 'default' : 'soft'} icon={template.built_in ? <Eye /> : <Pencil />}>
                        {template.built_in ? t('templates.view') : t('templates.edit')}
                    </ButtonLink>
                    <Button size="sm" variant="ghost" icon={<Copy />} pending={busy === 'duplicate'} onClick={() => void duplicate()}>
                        {t('templates.duplicate')}
                    </Button>
                    <span className="flex-1" />
                    {!template.built_in && (
                        <Menu
                            trigger={
                                <Button size="sm" variant="ghost" iconOnly icon={<MoreHorizontal />}>
                                    {t('templates.more')}
                                </Button>
                            }
                        >
                            <MenuItem danger icon={<Trash2 />} onSelect={() => setConfirm(true)}>
                                {t('templates.delete')}
                            </MenuItem>
                        </Menu>
                    )}
                </div>
            </div>
            <ConfirmDialog
                open={confirm}
                onClose={() => setConfirm(false)}
                onConfirm={() => void remove()}
                title={t('templates.delete_title', { name: template.name })}
                description={t('templates.delete_text')}
                confirmLabel={t('templates.delete')}
                pending={busy === 'delete'}
                danger
            />
        </article>
    );
}

/** First page with sample data; nothing is requested before the card comes near the viewport. */
function Thumbnail({ template }: { template: TemplateSummary }) {
    const [ref, inView] = useInView<HTMLDivElement>();
    const scenario = previewScenario(template.document_types);
    const { data } = useSWR<RenderResponse>(inView ? ['/api/render', 'thumbnail', template.id, template.updated_at, scenario] : null, () => renderTemplate({ template_id: template.id, scenario }), {
        revalidateOnFocus: false,
        shouldRetryOnError: false,
    });

    return (
        <div ref={ref} className="h-full">
            {data ? (
                <PagedPreview parts={data} paper={data.paper} maxPages={1} lazy labels={{ document: t('templates.preview_of', { name: template.name }) }} className="[&_.pp-page]:rounded-t-[3px]" />
            ) : (
                <Skeleton h="100%" r={3} />
            )}
        </div>
    );
}
