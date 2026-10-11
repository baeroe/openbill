import { Head, usePage } from '@inertiajs/react';
import { Page, PageHeader } from '@/components/ui';
import { appLayout } from '@/layouts/app-shell';
import { t } from '@/lib/i18n';
import type { SharedProps } from '@/types';

export default function Home() {
    const { auth } = usePage<SharedProps>().props;

    return (
        <Page>
            <Head title={t('home.title')} />
            <PageHeader title={t('home.title')} description={t('home.signed_in_as', { name: auth.user?.name ?? '' })} />
        </Page>
    );
}

Home.layout = appLayout;
