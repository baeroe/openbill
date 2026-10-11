import { FileText, LayoutGrid, Users, type LucideIcon } from 'lucide-react';
import { path, t } from '@/lib/i18n';

export type NavItem = { href: string; label: string; icon: LucideIcon; exact?: boolean };

/** Main navigation. Phase 7 adds Templates (after Customers). */
export function navItems(): NavItem[] {
    return [
        { href: path(''), label: t('nav.overview'), icon: LayoutGrid, exact: true },
        { href: path('/documents'), label: t('nav.documents'), icon: FileText },
        { href: path('/customers'), label: t('nav.customers'), icon: Users },
    ];
}

/** Group "Set up" (custom fields, settings): phase 7 fills it; the shell hides the group while it is empty. */
export function setupItems(): NavItem[] {
    return [];
}

/** `url` is Inertia's page URL (path + query). */
export function isActive(url: string, item: NavItem): boolean {
    const pathname = url.split(/[?#]/)[0];
    return item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);
}
