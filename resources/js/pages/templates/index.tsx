import { Head } from '@inertiajs/react';
import { Page, PageHeader, Skeleton } from '@/components/ui';
import { appLayout } from '@/layouts/app-shell';
import { t } from '@/lib/i18n';

export default function Templates() {
    return (
        <Page>
            <Head title={t('nav.templates')} />
            <PageHeader title={t('nav.templates')} description={t('templates.description')} />
            <Skeleton h={240} r={18} />
        </Page>
    );
}

Templates.layout = appLayout;
