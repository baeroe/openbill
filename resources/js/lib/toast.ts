import { useSyncExternalStore } from 'react';

export type ToastTone = 'neutral' | 'success' | 'error';
/** onExpire: the toast closed without its action (time up, close button, pushed out) – e.g. the delayed delete. */
export type ToastAction = { label: string; run(): void; onExpire?(): void };
export type Toast = { id: number; message: string; tone: ToastTone; action?: ToastAction };

/** How long a toast stays: errors and toasts with an action (undo) longer, so they can be read and used. */
const DURATION = { short: 3500, long: 6000 };

let toasts: Toast[] = [];
let sequence = 0;
let paused = false;
const listeners = new Set<() => void>();
/** Remaining time per toast; the timer runs only while the toasts are not paused. */
const timers = new Map<number, { remaining: number; started: number; handle: ReturnType<typeof setTimeout> | null }>();
const emit = () => listeners.forEach((listener) => listener());

export function currentToasts(): Toast[] {
    return toasts;
}

/** `used`: the action ran (undo), so onExpire does not. */
export function dismissToast(id: number, used = false): void {
    const timer = timers.get(id);
    if (timer?.handle) clearTimeout(timer.handle);
    timers.delete(id);
    const item = toasts.find((entry) => entry.id === id);
    toasts = toasts.filter((entry) => entry.id !== id);
    emit();
    if (item && !used) item.action?.onExpire?.();
}

function start(id: number): void {
    const timer = timers.get(id);
    if (!timer) return;
    timer.started = Date.now();
    timer.handle = setTimeout(() => dismissToast(id), timer.remaining);
}

function push(message: string, tone: ToastTone, action?: ToastAction): number {
    const id = ++sequence;
    const dropped = toasts.slice(0, -2);
    toasts = [...toasts.slice(-2), { id, message, tone, action }];
    dropped.forEach((item) => {
        const timer = timers.get(item.id);
        if (timer?.handle) clearTimeout(timer.handle);
        timers.delete(item.id);
    });
    timers.set(id, { remaining: action || tone === 'error' ? DURATION.long : DURATION.short, started: 0, handle: null });
    if (!paused) start(id);
    emit();
    dropped.forEach((item) => item.action?.onExpire?.());
    return id;
}

/** While the pointer or the keyboard focus is on the toasts, none of them closes (WCAG 2.2.1). */
export function pauseToasts(): void {
    if (paused) return;
    paused = true;
    for (const timer of timers.values()) {
        if (!timer.handle) continue;
        clearTimeout(timer.handle);
        timer.handle = null;
        timer.remaining = Math.max(0, timer.remaining - (Date.now() - timer.started));
    }
}

export function resumeToasts(): void {
    if (!paused) return;
    paused = false;
    for (const id of timers.keys()) start(id);
}

export const toast = {
    success: (message: string, action?: ToastAction) => push(message, 'success', action),
    error: (message: string) => push(message, 'error'),
    info: (message: string, action?: ToastAction) => push(message, 'neutral', action),
};

function subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
}

export function useToasts(): Toast[] {
    return useSyncExternalStore(subscribe, currentToasts, currentToasts);
}
