import { Head } from '@inertiajs/react';
import { Page, Skeleton } from '@/components/ui';
import { appLayout } from '@/layouts/app-shell';
import { t } from '@/lib/i18n';

export default function TemplatePage({ template_id: id }: { template_id: string }) {
    return (
        <Page>
            <Head title={t('nav.templates')} />
            <Skeleton h={480} r={18} className={id ? undefined : 'hidden'} />
        </Page>
    );
}

TemplatePage.layout = appLayout;
