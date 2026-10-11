import { router, usePage } from '@inertiajs/react';
import { Languages, LogOut, Monitor, Moon, Sun } from 'lucide-react';
import { Avatar, cx, Menu, MenuItem, MenuLabel, MenuRadioGroup, MenuRadioItem, MenuSeparator } from '@/components/ui';
import { localeHref, path, t } from '@/lib/i18n';
import { isThemePref, setThemePref, useThemePref } from '@/lib/theme';
import type { SharedProps } from '@/types';

/** Account chip at the bottom of the sidebar; the menu opens upwards. */
export function UserMenu({ collapsed }: { collapsed: boolean }) {
    const { auth, org, locale } = usePage<SharedProps>().props;
    const theme = useThemePref();
    const name = auth.user?.name ?? '';

    return (
        <Menu
            side="top"
            align="start"
            className="w-60"
            trigger={
                <button
                    type="button"
                    aria-label={t('user_menu.open')}
                    title={collapsed ? name : undefined}
                    className="flex w-full min-w-0 items-center gap-2 rounded-full p-2 text-left transition-colors hover:bg-surface-2 data-[state=open]:bg-surface-2 md:group-data-collapsed/shell:justify-center"
                >
                    <Avatar name={name} size="sm" />
                    <span className={cx('grid min-w-0', 'md:group-data-collapsed/shell:hidden')}>
                        <span className="truncate text-sm font-strong">{name}</span>
                        <span className="truncate text-xs text-muted">{org?.name ?? ''}</span>
                    </span>
                </button>
            }
        >
            <MenuLabel>{t('user_menu.appearance')}</MenuLabel>
            <MenuRadioGroup value={theme} onValueChange={(value) => isThemePref(value) && setThemePref(value)}>
                <MenuRadioItem value="system" icon={<Monitor />}>
                    {t('user_menu.theme_system')}
                </MenuRadioItem>
                <MenuRadioItem value="light" icon={<Sun />}>
                    {t('user_menu.theme_light')}
                </MenuRadioItem>
                <MenuRadioItem value="dark" icon={<Moon />}>
                    {t('user_menu.theme_dark')}
                </MenuRadioItem>
            </MenuRadioGroup>
            <MenuSeparator />
            <MenuLabel>{t('user_menu.language')}</MenuLabel>
            {/* other language = full page load (translations are loaded once per page) */}
            <MenuRadioGroup value={locale} onValueChange={(value) => value !== locale && window.location.assign(localeHref(value))}>
                <MenuRadioItem value="en" icon={<Languages />}>
                    {t('locale.en')}
                </MenuRadioItem>
                <MenuRadioItem value="de" icon={<Languages />}>
                    {t('locale.de')}
                </MenuRadioItem>
            </MenuRadioGroup>
            <MenuSeparator />
            <MenuItem icon={<LogOut />} onSelect={() => router.post(path('/logout'))}>
                {t('common.logout')}
            </MenuItem>
        </Menu>
    );
}
