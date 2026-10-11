import { Link } from '@inertiajs/react';
import { ChevronLeft } from 'lucide-react';
import type { ReactNode } from 'react';
import { cx } from './cx';

/** Content area of a page inside the workspace. `wide` drops the max width (editor in phase 6). */
export function Page({ wide = false, className, children }: { wide?: boolean; className?: string; children: ReactNode }) {
    return <div className={cx('mx-auto grid content-start gap-6 px-4 pt-5 pb-12 sm:px-8 sm:pt-8 sm:pb-16', !wide && 'max-w-[1320px]', className)}>{children}</div>;
}

export function BackLink({ href, children }: { href: string; children: ReactNode }) {
    return (
        <Link href={href} className="inline-flex items-center gap-1 justify-self-start text-sm font-medium text-muted no-underline hover:text-ink [&_svg]:size-4">
            <ChevronLeft aria-hidden />
            {children}
        </Link>
    );
}

export function PageHeader({ title, description, actions, back }: { title: ReactNode; description?: ReactNode; actions?: ReactNode; back?: { href: string; label: string } }) {
    return (
        <header className="flex flex-wrap items-end gap-4">
            <div className="grid min-w-0 gap-1">
                {back && <BackLink href={back.href}>{back.label}</BackLink>}
                <h1 className="text-2xl font-bold tracking-title sm:text-3xl">{title}</h1>
                {description && <p className="max-w-[64ch] text-muted">{description}</p>}
            </div>
            {actions && <div className="ml-auto flex flex-wrap items-center gap-3">{actions}</div>}
        </header>
    );
}
