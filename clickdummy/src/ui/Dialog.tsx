import { useEffect, useRef, type ReactNode } from 'react'
import { X } from 'lucide-react'
import { cx } from './cx'
import { Button } from './Button'

export function Dialog({ open, onClose, title, children, footer, wide }: {
  open: boolean
  onClose(): void
  title: string
  children: ReactNode
  footer?: ReactNode
  wide?: boolean
}) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (open && !el.open) el.showModal()
    if (!open && el.open) el.close()
  }, [open])

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
      className={cx(
        'm-auto max-h-[85vh] w-[calc(100%-32px)] rounded-[4px] border border-line bg-sheet p-0 text-ink shadow-2xl backdrop:bg-[#16182a]/40',
        wide ? 'max-w-3xl' : 'max-w-lg',
      )}
    >
      {open && (
        <div className="flex max-h-[85vh] flex-col">
          <header className="flex items-center justify-between border-b border-line px-5 py-3">
            <h2 className="text-[15px] font-semibold">{title}</h2>
            <Button variant="ghost" size="sm" onClick={onClose} aria-label="Schließen" icon={<X size={16} />} />
          </header>
          <div className="overflow-y-auto px-5 py-4">{children}</div>
          {footer && <footer className="flex justify-end gap-2 border-t border-line bg-sheet-2 px-5 py-3">{footer}</footer>}
        </div>
      )}
    </dialog>
  )
}

export function ConfirmDialog({ open, onClose, onConfirm, title, text, confirmLabel, danger }: {
  open: boolean
  onClose(): void
  onConfirm(): void
  title: string
  text: ReactNode
  confirmLabel: string
  danger?: boolean
}) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      footer={
        <>
          <Button onClick={onClose}>Abbrechen</Button>
          <Button variant={danger ? 'danger' : 'primary'} onClick={() => { onConfirm(); onClose() }}>{confirmLabel}</Button>
        </>
      }
    >
      <div className="text-sm leading-relaxed text-muted">{text}</div>
    </Dialog>
  )
}
