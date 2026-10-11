import { Link, router, usePage } from '@inertiajs/react';
import { Menu as MenuIcon, PanelLeftClose, PanelLeftOpen, Plus } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { NewDocumentProvider, useNewDocument } from '@/components/new-document/new-document-context';
import { Button, cx, Toaster } from '@/components/ui';
import { path, t } from '@/lib/i18n';
import { useStoredFlag } from '@/lib/prefs';
import { LogoMark } from './logo';
import { isActive, navItems, setupItems, type NavItem } from './nav';
import { UserMenu } from './user-menu';

/** Hidden while the sidebar is collapsed (desktop only: the mobile drawer is always full width). */
const HIDE_COLLAPSED = 'md:group-data-collapsed/shell:hidden';

const NAV_LINK =
    'flex h-10 items-center gap-3 rounded-full px-3 font-strong whitespace-nowrap text-muted no-underline transition-colors hover:bg-surface-2 hover:text-ink [&_svg]:size-[1.125rem] [&_svg]:shrink-0 md:group-data-collapsed/shell:justify-center md:group-data-collapsed/shell:px-0';

/**
 * Persistent Inertia layout: `Page.layout = appLayout` keeps the shell mounted across visits.
 * Must stay an arrow function: Inertia v3 only treats prototype-less functions as `(page) => layout`
 * resolvers; a `function` declaration would be rendered as a layout component with the page props.
 */
export const appLayout = (page: ReactNode): ReactNode => <AppShell>{page}</AppShell>;

export function AppShell({ children }: { children: ReactNode }) {
    return (
        <NewDocumentProvider>
            <Shell>{children}</Shell>
            <Toaster />
        </NewDocumentProvider>
    );
}

function Shell({ children }: { children: ReactNode }) {
    const { url } = usePage();
    const [collapsed, setCollapsed] = useStoredFlag('openbill:sidebar-collapsed');
    const [mobileOpen, setMobileOpen] = useState(false);
    const openNewDocument = useNewDocument();
    const setup = setupItems();

    useEffect(() => router.on('navigate', () => setMobileOpen(false)), []);

    // "N" opens "New document" everywhere, unless the user types somewhere or a dialog/menu is open
    useEffect(() => {
        const onKey = (event: KeyboardEvent) => {
            if (event.key.toLowerCase() !== 'n' || event.metaKey || event.ctrlKey || event.altKey || event.repeat) return;
            const target = event.target as HTMLElement | null;
            if (target?.closest('input, textarea, select, [contenteditable="true"], .cm-editor, [role="dialog"], [role="menu"]')) return;
            if (document.querySelector('[role="dialog"], [role="menu"]')) return;
            event.preventDefault();
            openNewDocument();
        };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [openNewDocument]);

    useEffect(() => {
        if (!mobileOpen) return;
        const onKey = (event: KeyboardEvent) => event.key === 'Escape' && setMobileOpen(false);
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [mobileOpen]);

    return (
        <div data-collapsed={collapsed || undefined} className={cx('group/shell grid min-h-dvh grid-cols-1', collapsed ? 'md:grid-cols-[4.5rem_minmax(0,1fr)]' : 'md:grid-cols-[15rem_minmax(0,1fr)]')}>
            <a href="#main" className="sr-only rounded-full bg-accent px-4 py-2 text-accent-ink focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50">
                {t('shell.skip')}
            </a>

            <aside
                aria-label={t('shell.sidebar')}
                className={cx(
                    'flex-col gap-1 px-3 py-5',
                    mobileOpen ? 'fixed inset-y-0 left-0 z-[45] flex w-68 overflow-y-auto bg-bg shadow-float' : 'hidden',
                    'md:sticky md:top-0 md:z-auto md:flex md:h-dvh md:w-auto md:bg-transparent md:shadow-none',
                )}
            >
                <Link href={path('')} className="flex items-center gap-2.5 px-2 pb-5 text-xl font-bold tracking-brand text-ink no-underline md:group-data-collapsed/shell:justify-center md:group-data-collapsed/shell:px-0">
                    <LogoMark />
                    <span className={HIDE_COLLAPSED}>openbill</span>
                </Link>

                {/* own classes instead of <Button>: it is left-aligned and changes shape when collapsed */}
                <button
                    type="button"
                    onClick={() => openNewDocument()}
                    title={t('shell.new_document_hint')}
                    aria-label={t('shell.new_document')}
                    className="mb-4 flex h-control items-center gap-2 rounded-full bg-accent pr-4 pl-3 font-strong whitespace-nowrap text-accent-ink transition-[background-color,transform] hover:bg-accent-hover active:scale-[0.98] [&_svg]:size-4 [&_svg]:shrink-0 md:group-data-collapsed/shell:mx-auto md:group-data-collapsed/shell:w-10 md:group-data-collapsed/shell:justify-center md:group-data-collapsed/shell:px-0"
                >
                    <Plus aria-hidden />
                    <span className={HIDE_COLLAPSED}>{t('shell.new_document')}</span>
                </button>

                <nav aria-label={t('nav.main')} className="grid gap-0.5">
                    {navItems().map((item) => (
                        <NavLink key={item.href} item={item} active={isActive(url, item)} collapsed={collapsed} />
                    ))}
                    {setup.length > 0 && (
                        <>
                            <div className="h-4" />
                            <div className={cx('px-3 pt-2 pb-1 text-xs font-medium text-faint', HIDE_COLLAPSED)}>{t('nav.setup')}</div>
                            {setup.map((item) => (
                                <NavLink key={item.href} item={item} active={isActive(url, item)} collapsed={collapsed} />
                            ))}
                        </>
                    )}
                </nav>

                <div className="mt-auto grid gap-1">
                    <UserMenu collapsed={collapsed} />
                    <button
                        type="button"
                        onClick={() => setCollapsed(!collapsed)}
                        aria-label={collapsed ? t('shell.expand') : undefined}
                        title={collapsed ? t('shell.expand') : undefined}
                        className={cx(NAV_LINK, 'hidden md:flex')}
                    >
                        {collapsed ? <PanelLeftOpen aria-hidden /> : <PanelLeftClose aria-hidden />}
                        <span className={HIDE_COLLAPSED}>{t('shell.collapse')}</span>
                    </button>
                </div>
            </aside>
            {mobileOpen && <div aria-hidden className="fixed inset-0 z-[44] animate-overlay-in bg-overlay md:hidden" onClick={() => setMobileOpen(false)} />}

            <div className="min-w-0 md:py-3 md:pr-3">
                <div className="sticky top-0 z-30 flex h-14 items-center gap-2 bg-bg px-3 md:hidden">
                    <Button variant="ghost" iconOnly icon={<MenuIcon />} onClick={() => setMobileOpen(true)}>
                        {t('shell.open_navigation')}
                    </Button>
                    <Link href={path('')} className="flex items-center gap-2.5 text-lg font-bold tracking-brand text-ink no-underline">
                        <LogoMark />
                        <span>openbill</span>
                    </Link>
                    <Button variant="primary" size="sm" icon={<Plus />} onClick={() => openNewDocument()} className="ml-auto">
                        {t('shell.new_short')}
                    </Button>
                </div>
                <main id="main" className="min-h-[calc(100dvh-3.5rem)] overflow-clip bg-surface md:min-h-[calc(100dvh-1.5rem)] md:rounded-xl">
                    {children}
                </main>
            </div>
        </div>
    );
}

function NavLink({ item, active, collapsed }: { item: NavItem; active: boolean; collapsed: boolean }) {
    const Icon = item.icon;
    return (
        <Link
            href={item.href}
            aria-current={active ? 'page' : undefined}
            aria-label={collapsed ? item.label : undefined}
            title={collapsed ? item.label : undefined}
            className={cx(NAV_LINK, 'aria-[current=page]:bg-accent-soft aria-[current=page]:text-accent')}
        >
            <Icon aria-hidden />
            <span className={HIDE_COLLAPSED}>{item.label}</span>
        </Link>
    );
}
