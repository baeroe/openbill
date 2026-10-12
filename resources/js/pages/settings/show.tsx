import { Head, Link } from '@inertiajs/react';
import type { ReactNode } from 'react';
import { Page, PageHeader, cx } from '@/components/ui';
import { appLayout } from '@/layouts/app-shell';
import { path, t } from '@/lib/i18n';
import { ApiSettings } from '@/settings/api-settings';
import { DocumentTypeSettings } from '@/settings/document-types';
import { OrganizationSettings } from '@/settings/organization';
import { TaxesUnitsSettings } from '@/settings/taxes-units';
import { TextBlockSettings } from '@/settings/text-blocks';
import { UserSettings } from '@/settings/users';
import { SECTION_ICONS, SETTINGS_SECTIONS, sectionKey, type SettingsSection } from '@/settings/sections';

type Props = { section: SettingsSection; can_manage_users: boolean; mcp_url: string; api_docs_url: string };

const LINK =
    'flex h-10 items-center gap-3 rounded-full px-3 font-strong whitespace-nowrap text-muted no-underline transition-colors hover:bg-surface-2 hover:text-ink [&_svg]:size-[1.05rem] [&_svg]:shrink-0 md:max-lg:h-9 md:max-lg:text-sm';
const ACTIVE = 'flex h-10 items-center gap-3 rounded-full bg-ink px-3 font-strong whitespace-nowrap text-bg no-underline [&_svg]:size-[1.05rem] [&_svg]:shrink-0';

/** Settings (/{locale}/settings/{section}): section navigation left (top below 900 px), the section right. */
export default function SettingsPage({ section, can_manage_users: canManageUsers, mcp_url: mcpUrl, api_docs_url: apiDocsUrl }: Props) {
    return (
        <Page>
            <Head title={`${t(sectionKey(section))} · ${t('nav.settings')}`} />
            <PageHeader title={t('nav.settings')} description={t('settings.description')} />
            <div className="grid items-start gap-5 md:grid-cols-[13rem_minmax(0,1fr)] md:gap-8">
                <nav aria-label={t('settings.nav_label')} className="flex gap-1 overflow-x-auto pb-0.5 md:sticky md:top-6 md:grid md:gap-0.5 md:overflow-visible">
                    {SETTINGS_SECTIONS.map((item) => {
                        const Icon = SECTION_ICONS[item];
                        return (
                            <Link key={item} href={path(`/settings/${item}`)} aria-current={item === section ? 'page' : undefined} className={item === section ? ACTIVE : LINK}>
                                <Icon aria-hidden />
                                <span>{t(sectionKey(item))}</span>
                            </Link>
                        );
                    })}
                </nav>
                <div className={cx('grid min-w-0 gap-6')}>{renderSection(section, canManageUsers, { mcpUrl, apiDocsUrl })}</div>
            </div>
        </Page>
    );
}

function renderSection(section: SettingsSection, canManageUsers: boolean, urls: { mcpUrl: string; apiDocsUrl: string }): ReactNode {
    switch (section) {
        case 'organization':
            return <OrganizationSettings />;
        case 'document-types':
            return <DocumentTypeSettings />;
        case 'taxes-units':
            return <TaxesUnitsSettings />;
        case 'text-blocks':
            return <TextBlockSettings />;
        case 'users':
            return <UserSettings canManage={canManageUsers} />;
        case 'api':
            return <ApiSettings mcpUrl={urls.mcpUrl} apiDocsUrl={urls.apiDocsUrl} />;
    }
}

SettingsPage.layout = appLayout;
