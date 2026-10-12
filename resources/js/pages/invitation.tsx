import { Head } from '@inertiajs/react';
import { t } from '@/lib/i18n';

export default function Invitation({ state }: { state: 'open' | 'expired' | 'closed' }) {
    return (
        <main className="grid min-h-dvh place-items-center p-6">
            <Head title={t('invitation.title')} />
            <p data-state={state}>{t('invitation.title')}</p>
        </main>
    );
}
