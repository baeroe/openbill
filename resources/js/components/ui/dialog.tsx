import * as RadixDialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import type { ReactNode } from 'react';
import { t } from '@/lib/i18n';
import { Button } from './button';
import { cx } from './cx';

type DialogProps = {
    open: boolean;
    onClose(): void;
    title: ReactNode;
    description?: ReactNode;
    children?: ReactNode;
    footer?: ReactNode;
    wide?: boolean;
};

/** Focus the first field (or [data-autofocus]) instead of the close button, like the clickdummy. */
function focusFirstField(event: Event): void {
    const content = event.currentTarget as HTMLElement | null;
    const target = content?.querySelector<HTMLElement>('[data-autofocus], input:not([type=hidden]), select, textarea');
    if (target) {
        event.preventDefault();
        target.focus();
    }
}

function Head({ title, description }: { title: ReactNode; description?: ReactNode }) {
    return (
        <div className="flex items-start gap-3">
            <div className="min-w-0 flex-1">
                <RadixDialog.Title className="text-xl">{title}</RadixDialog.Title>
                {description && <RadixDialog.Description className="mt-1 text-muted">{description}</RadixDialog.Description>}
            </div>
            <RadixDialog.Close asChild>
                <Button variant="ghost" size="sm" iconOnly icon={<X />}>
                    {t('common.close')}
                </Button>
            </RadixDialog.Close>
        </div>
    );
}

/** Centered modal (Radix: focus trap, Escape, scroll lock, aria). */
export function Dialog({ open, onClose, title, description, children, footer, wide = false }: DialogProps) {
    return (
        <RadixDialog.Root open={open} onOpenChange={(next) => !next && onClose()}>
            <RadixDialog.Portal>
                <RadixDialog.Overlay className="fixed inset-0 z-50 grid animate-overlay-in place-items-center overflow-y-auto bg-overlay p-4 data-[state=closed]:animate-overlay-out">
                    <RadixDialog.Content
                        onOpenAutoFocus={focusFirstField}
                        {...(description ? {} : { 'aria-describedby': undefined })}
                        className={cx('grid max-h-[calc(100dvh-2rem)] w-full animate-pop-in gap-5 overflow-auto rounded-xl bg-surface p-6 shadow-float focus:outline-none data-[state=closed]:animate-pop-out', wide ? 'max-w-[44rem]' : 'max-w-[32rem]')}
                    >
                        <Head title={title} description={description} />
                        {children}
                        {footer && <div className="flex flex-wrap justify-end gap-2">{footer}</div>}
                    </RadixDialog.Content>
                </RadixDialog.Overlay>
            </RadixDialog.Portal>
        </RadixDialog.Root>
    );
}

/** Side panel from the right, for forms next to their context. */
export function Drawer({ open, onClose, title, description, children, footer }: Omit<DialogProps, 'wide'>) {
    return (
        <RadixDialog.Root open={open} onOpenChange={(next) => !next && onClose()}>
            <RadixDialog.Portal>
                <RadixDialog.Overlay className="fixed inset-0 z-50 animate-overlay-in bg-overlay data-[state=closed]:animate-overlay-out" />
                <RadixDialog.Content
                    onOpenAutoFocus={focusFirstField}
                    {...(description ? {} : { 'aria-describedby': undefined })}
                    className="fixed top-3 right-3 bottom-3 z-50 grid w-[min(calc(100%-1.5rem),30rem)] animate-slide-in grid-rows-[auto_1fr_auto] overflow-auto rounded-xl bg-surface shadow-float focus:outline-none data-[state=closed]:animate-slide-out"
                >
                    <div className="px-6 pt-6 pb-4">
                        <Head title={title} description={description} />
                    </div>
                    <div className="grid content-start gap-5 px-6 pb-6">{children}</div>
                    {footer && <div className="sticky bottom-0 flex justify-end gap-2 rounded-b-xl bg-surface px-6 py-4">{footer}</div>}
                </RadixDialog.Content>
            </RadixDialog.Portal>
        </RadixDialog.Root>
    );
}

type ConfirmProps = {
    open: boolean;
    onClose(): void;
    onConfirm(): void;
    title: ReactNode;
    description?: ReactNode;
    confirmLabel: string;
    pending?: boolean;
    danger?: boolean;
    icon?: ReactNode;
};

export function ConfirmDialog({ open, onClose, onConfirm, title, description, confirmLabel, pending = false, danger = false, icon }: ConfirmProps) {
    return (
        <Dialog
            open={open}
            onClose={onClose}
            title={title}
            description={description}
            footer={
                <>
                    <Button variant="ghost" onClick={onClose}>
                        {t('common.cancel')}
                    </Button>
                    <Button variant={danger ? 'danger' : 'primary'} icon={icon} pending={pending} onClick={onConfirm} data-autofocus>
                        {confirmLabel}
                    </Button>
                </>
            }
        />
    );
}
