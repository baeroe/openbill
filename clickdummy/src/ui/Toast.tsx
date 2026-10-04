import { create } from 'zustand'
import { cx } from './cx'

type ToastTone = 'ok' | 'warn' | 'danger'
interface ToastItem { id: number; message: string; tone: ToastTone }
interface ToastState { items: ToastItem[]; push(message: string, tone?: ToastTone): void; dismiss(id: number): void }

let seq = 0
export const useToastStore = create<ToastState>((set) => ({
  items: [],
  push: (message, tone = 'ok') => {
    const id = ++seq
    set((s) => ({ items: [...s.items, { id, message, tone }] }))
    setTimeout(() => set((s) => ({ items: s.items.filter((t) => t.id !== id) })), 4200)
  },
  dismiss: (id) => set((s) => ({ items: s.items.filter((t) => t.id !== id) })),
}))

export const toast = (message: string, tone?: ToastTone) => useToastStore.getState().push(message, tone)

export function ToastHost() {
  const { items, dismiss } = useToastStore()
  return (
    <div aria-live="polite" className="pointer-events-none fixed right-4 bottom-4 z-50 flex w-[min(380px,calc(100%-32px))] flex-col gap-2">
      {items.map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() => dismiss(t.id)}
          className={cx(
            'pointer-events-auto rounded-[4px] border-l-4 bg-ink px-4 py-3 text-left text-sm text-sheet shadow-xl',
            t.tone === 'ok' && 'border-ok',
            t.tone === 'warn' && 'border-[#e0a84a]',
            t.tone === 'danger' && 'border-danger',
          )}
        >
          {t.message}
        </button>
      ))}
    </div>
  )
}
