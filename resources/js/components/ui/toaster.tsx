import { AlertCircle, Check, Info } from 'lucide-react';
import { dismissToast, useToasts } from '@/lib/toast';
import { cx } from './cx';

export function Toaster() {
    const toasts = useToasts();

    return (
        // toasts move above a sticky save bar ([data-savebar]) instead of covering its buttons
        <div role="status" aria-live="polite" className="fixed bottom-5 left-1/2 z-60 grid w-[min(calc(100%-2rem),26rem)] -translate-x-1/2 gap-2 [body:has([data-savebar])_&]:bottom-20">
            {toasts.map((item) => (
                <div
                    key={item.id}
                    className={cx(
                        'flex animate-pop-in items-center gap-3 rounded-full py-2.5 pr-2.5 pl-4 text-sm font-medium shadow-float [&>svg]:size-4 [&>svg]:shrink-0',
                        item.tone === 'error' ? 'bg-bad text-white dark:text-bg' : 'bg-ink text-bg',
                    )}
                >
                    {item.tone === 'success' ? <Check aria-hidden /> : item.tone === 'error' ? <AlertCircle aria-hidden /> : <Info aria-hidden />}
                    <span className="min-w-0 flex-1">{item.message}</span>
                    {item.action && (
                        <button
                            type="button"
                            className="h-7 shrink-0 rounded-full bg-white/15 px-3 text-xs font-strong hover:bg-white/25 dark:bg-black/10 dark:hover:bg-black/20"
                            onClick={() => {
                                item.action?.run();
                                dismissToast(item.id);
                            }}
                        >
                            {item.action.label}
                        </button>
                    )}
                </div>
            ))}
        </div>
    );
}
