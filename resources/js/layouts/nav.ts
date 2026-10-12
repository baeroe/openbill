import { FileText, LayoutGrid, ListPlus, Settings, SquareCode, Users, type LucideIcon } from 'lucide-react';
import { path, t } from '@/lib/i18n';

export type NavItem = { href: string; label: string; icon: LucideIcon; exact?: boolean };

/** Main navigation. */
export function navItems(): NavItem[] {
    return [
        { href: path(''), label: t('nav.overview'), icon: LayoutGrid, exact: true },
        { href: path('/documents'), label: t('nav.documents'), icon: FileText },
        { href: path('/customers'), label: t('nav.customers'), icon: Users },
        { href: path('/templates'), label: t('nav.templates'), icon: SquareCode },
    ];
}

/** Group "Set up": custom fields and settings. */
export function setupItems(): NavItem[] {
    return [
        { href: path('/fields'), label: t('nav.fields'), icon: ListPlus },
        { href: path('/settings'), label: t('nav.settings'), icon: Settings },
    ];
}

/** `url` is Inertia's page URL (path + query). */
export function isActive(url: string, item: NavItem): boolean {
    const pathname = url.split(/[?#]/)[0];
    return item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);
}
