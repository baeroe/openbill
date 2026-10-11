import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import type { ReactElement, ReactNode } from 'react';
import { t } from '@/lib/i18n';
import { Tag } from './badge';
import { cx } from './cx';

const ITEM =
    'flex w-full cursor-pointer items-center gap-2 rounded-sm px-2.5 py-2 text-left text-md text-ink no-underline outline-none select-none data-[disabled]:cursor-not-allowed data-[disabled]:opacity-45 data-[highlighted]:bg-surface-2 [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-muted';

/**
 * Drop-down menu (Radix: arrow keys, typeahead, Escape, focus return). Not modal: a dialog opened from an
 * item would otherwise inherit Radix' pointer-events lock on <body>.
 */
export function Menu({ trigger, children, align = 'end', side = 'bottom', className }: { trigger: ReactElement; children: ReactNode; align?: 'start' | 'end'; side?: 'top' | 'bottom'; className?: string }) {
    return (
        <DropdownMenu.Root modal={false}>
            <DropdownMenu.Trigger asChild>{trigger}</DropdownMenu.Trigger>
            <DropdownMenu.Portal>
                <DropdownMenu.Content align={align} side={side} sideOffset={6} className={cx('z-40 grid min-w-56 animate-menu-in rounded-md bg-surface p-1.5 shadow-float focus:outline-none', className)}>
                    {children}
                </DropdownMenu.Content>
            </DropdownMenu.Portal>
        </DropdownMenu.Root>
    );
}

export function MenuItem({ icon, danger = false, onSelect, disabled, children }: { icon?: ReactNode; danger?: boolean; onSelect?: () => void; disabled?: boolean; children: ReactNode }) {
    return (
        <DropdownMenu.Item onSelect={onSelect} disabled={disabled} className={cx(ITEM, danger && 'text-bad [&_svg]:text-bad')}>
            {icon}
            {children}
        </DropdownMenu.Item>
    );
}

export function MenuLabel({ children }: { children: ReactNode }) {
    return <DropdownMenu.Label className="px-2.5 pt-1.5 pb-0.5 text-xs font-medium text-muted">{children}</DropdownMenu.Label>;
}

export function MenuSeparator() {
    return <DropdownMenu.Separator className="mx-1.5 my-1 h-px bg-surface-2" />;
}

export function MenuRadioGroup({ value, onValueChange, children }: { value: string; onValueChange(value: string): void; children: ReactNode }) {
    return (
        <DropdownMenu.RadioGroup value={value} onValueChange={onValueChange}>
            {children}
        </DropdownMenu.RadioGroup>
    );
}

export function MenuRadioItem({ value, icon, children }: { value: string; icon?: ReactNode; children: ReactNode }) {
    return (
        <DropdownMenu.RadioItem value={value} className={ITEM}>
            {icon}
            {children}
            <DropdownMenu.ItemIndicator className="ml-auto">
                <Tag>{t('menu.active')}</Tag>
            </DropdownMenu.ItemIndicator>
        </DropdownMenu.RadioItem>
    );
}
