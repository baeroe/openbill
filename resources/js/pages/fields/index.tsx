import { Head } from '@inertiajs/react';
import type { FieldScope } from '@/api/types';
import { Page, PageHeader, Skeleton } from '@/components/ui';
import { appLayout } from '@/layouts/app-shell';
import { t } from '@/lib/i18n';

export default function Fields({ scope }: { scope: FieldScope }) {
    return (
        <Page>
            <Head title={t('nav.fields')} />
            <PageHeader title={t('nav.fields')} description={t('fields.description')} />
            <Skeleton h={240} r={18} className={scope ? undefined : 'hidden'} />
        </Page>
    );
}

Fields.layout = appLayout;
