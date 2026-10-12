import { Head } from '@inertiajs/react';
import { FileArchive, SquareCode } from 'lucide-react';
import { useDocumentTypes } from '@/api/settings';
import { useTemplates } from '@/api/templates';
import { Card, EmptyState, ErrorState, Page, PageHeader, Skeleton } from '@/components/ui';
import { appLayout } from '@/layouts/app-shell';
import { t } from '@/lib/i18n';
import { GalleryCard } from '@/templates/gallery-card';
import { ImportButton } from '@/templates/import-button';

const FILES = ['manifest', 'header', 'template', 'footer', 'styles', 'assets'] as const;
const FILE_NAMES: Record<(typeof FILES)[number], string> = {
    manifest: 'manifest.json',
    header: 'header.liquid',
    template: 'template.liquid',
    footer: 'footer.liquid',
    styles: 'styles.css',
    assets: 'assets/',
};

/** Template gallery (/{locale}/templates). */
export default function Templates() {
    const templates = useTemplates();
    const documentTypes = useDocumentTypes();
    const error = templates.error ?? documentTypes.error;

    return (
        <Page>
            <Head title={t('nav.templates')} />
            <PageHeader title={t('nav.templates')} description={t('templates.description')} actions={<ImportButton />} />

            {error ? (
                <ErrorState
                    error={error}
                    onRetry={() => {
                        void templates.mutate();
                        void documentTypes.mutate();
                    }}
                />
            ) : !templates.data || !documentTypes.data ? (
                <div className="grid grid-cols-[repeat(auto-fill,minmax(17rem,1fr))] gap-5" aria-busy="true" aria-label={t('templates.loading')}>
                    {[0, 1, 2].map((i) => (
                        <div key={i} className="overflow-hidden rounded-lg bg-bg">
                            <Skeleton h={240} r={0} />
                            <div className="grid gap-2 px-5 pt-4 pb-5">
                                <Skeleton w="45%" h={16} />
                                <Skeleton w="90%" h={12} />
                            </div>
                        </div>
                    ))}
                </div>
            ) : templates.data.length === 0 ? (
                <Card>
                    <EmptyState icon={<SquareCode />} title={t('templates.empty')} actions={<ImportButton />}>
                        {t('templates.empty_text')}
                    </EmptyState>
                </Card>
            ) : (
                <div className="grid grid-cols-[repeat(auto-fill,minmax(17rem,1fr))] gap-5">
                    {templates.data.map((template) => (
                        <GalleryCard key={template.id} template={template} documentTypes={documentTypes.data!} />
                    ))}
                </div>
            )}

            <Card aria-labelledby="template-package" className="grid items-start gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
                <div>
                    <div className="flex items-center gap-2">
                        <FileArchive aria-hidden className="size-[18px]" />
                        <h2 id="template-package" className="text-lg">
                            {t('templates.package_title')}
                        </h2>
                    </div>
                    <p className="mt-1 max-w-[52ch] text-sm text-muted">{t('templates.package_text')}</p>
                </div>
                <ul className="m-0 grid list-none gap-0.5 p-0">
                    {FILES.map((file) => (
                        <li key={file} className="grid items-baseline gap-0.5 rounded-sm bg-surface-2 px-3 py-2 text-sm sm:grid-cols-[9.5rem_minmax(0,1fr)] sm:gap-3">
                            <code className="justify-self-start rounded-sm bg-bg px-1.5 font-mono text-xs">{FILE_NAMES[file]}</code>
                            <span className="text-muted">{t(`templates.file.${file}`)}</span>
                        </li>
                    ))}
                </ul>
            </Card>
        </Page>
    );
}

Templates.layout = appLayout;
