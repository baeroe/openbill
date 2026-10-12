import { Head } from '@inertiajs/react';
import { FileQuestion } from 'lucide-react';
import { useTemplate } from '@/api/templates';
import { ButtonLink, EmptyState, ErrorState, Page, Skeleton } from '@/components/ui';
import { appLayout } from '@/layouts/app-shell';
import { ApiError } from '@/lib/api';
import { path, t } from '@/lib/i18n';
import { TemplateEditor } from '@/templates/editor/template-editor';

/** Template editor (/{locale}/templates/{id}): the template from GET /api/templates/{id}. */
export default function TemplatePage({ template_id: id }: { template_id: string }) {
    const { data: template, error, mutate } = useTemplate(id);

    if (error && !template) {
        return (
            <Page>
                <Head title={t('nav.templates')} />
                {error instanceof ApiError && error.status === 404 ? (
                    <EmptyState
                        icon={<FileQuestion />}
                        title={t('templates.not_found')}
                        actions={
                            <ButtonLink href={path('/templates')} variant="primary">
                                {t('templates.back')}
                            </ButtonLink>
                        }
                    />
                ) : (
                    <ErrorState error={error} onRetry={() => void mutate()} />
                )}
            </Page>
        );
    }

    return (
        <>
            <Head title={template ? `${template.name} · ${t('nav.templates')}` : t('nav.templates')} />
            {template ? <TemplateEditor key={template.id} template={template} /> : <EditorSkeleton />}
        </>
    );
}

function EditorSkeleton() {
    return (
        <div className="grid gap-3 p-6" aria-busy="true" aria-label={t('templates.loading_one')}>
            <Skeleton w={220} h={28} />
            <div className="grid gap-3 lg:grid-cols-[15rem_minmax(0,1fr)_minmax(0,0.9fr)]">
                <Skeleton h={520} r={18} />
                <Skeleton h={520} r={18} />
                <Skeleton h={520} r={18} />
            </div>
        </div>
    );
}

TemplatePage.layout = appLayout;
