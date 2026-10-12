import type { ReactNode } from 'react';
import { LogoMark } from '@/layouts/logo';

/**
 * Signed-out pages (login, invitation): one card centred on the page background, the logo on top. `corner` sits in the
 * top right of the page (the language switch of the login). Only imports the logo, so the login chunk stays small.
 */
export function AuthCard({ corner, children }: { corner?: ReactNode; children: ReactNode }) {
    return (
        <main className="relative grid min-h-dvh place-items-center px-4 py-16">
            {corner && <div className="absolute top-3 right-3">{corner}</div>}
            <div className="grid w-full max-w-[25rem] animate-fade-in gap-7 rounded-lg bg-surface p-6 shadow-float xs:p-8">
                <div className="flex items-center gap-2.5 text-xl font-bold tracking-brand">
                    <LogoMark />
                    <span>openbill</span>
                </div>
                {children}
            </div>
        </main>
    );
}
