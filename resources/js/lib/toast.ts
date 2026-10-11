import { useSyncExternalStore } from 'react';

export type ToastTone = 'neutral' | 'success' | 'error';
export type ToastAction = { label: string; run(): void };
export type Toast = { id: number; message: string; tone: ToastTone; action?: ToastAction };

let toasts: Toast[] = [];
let sequence = 0;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((listener) => listener());

export function currentToasts(): Toast[] {
    return toasts;
}

export function dismissToast(id: number): void {
    toasts = toasts.filter((item) => item.id !== id);
    emit();
}

function push(message: string, tone: ToastTone, action?: ToastAction): number {
    const id = ++sequence;
    toasts = [...toasts.slice(-2), { id, message, tone, action }];
    emit();
    // with an action (undo) the toast stays longer
    setTimeout(() => dismissToast(id), action ? 6000 : 3500);
    return id;
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
