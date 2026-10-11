import { create } from 'zustand'

export interface Toast { id: number; message: string; tone: 'neutral' | 'success' | 'error'; action?: { label: string; run(): void } }

interface ToastState {
  toasts: Toast[]
  push(t: Omit<Toast, 'id'>): void
  dismiss(id: number): void
}

let seq = 0
export const useToastStore = create<ToastState>()((set, get) => ({
  toasts: [],
  push: (t) => {
    const id = ++seq
    set((s) => ({ toasts: [...s.toasts.slice(-2), { ...t, id }] }))
    setTimeout(() => get().dismiss(id), t.action ? 6000 : 3500)
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((x) => x.id !== id) })),
}))

export const toast = {
  success: (message: string, action?: Toast['action']) => useToastStore.getState().push({ message, tone: 'success', action }),
  error: (message: string) => useToastStore.getState().push({ message, tone: 'error' }),
  info: (message: string, action?: Toast['action']) => useToastStore.getState().push({ message, tone: 'neutral', action }),
}
