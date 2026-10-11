import { useEffect, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { Button } from './Button'
import { cx } from './cx'

function useModal(open: boolean, onClose: () => void) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const prev = document.activeElement as HTMLElement | null
    const el = ref.current
    const first = el?.querySelector<HTMLElement>('[data-autofocus]') ?? el?.querySelector<HTMLElement>('input, select, textarea, button:not([data-close])')
    first?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'Tab' && el) {
        const items = [...el.querySelectorAll<HTMLElement>('a[href], button:not(:disabled), input:not(:disabled), select, textarea, [tabindex]:not([tabindex="-1"])')]
        if (!items.length) return
        const [a, z] = [items[0], items[items.length - 1]]
        if (e.shiftKey && document.activeElement === a) { e.preventDefault(); z.focus() }
        else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus() }
      }
    }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
      prev?.focus()
    }
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps
  return ref
}

interface DialogProps { open: boolean; onClose(): void; title: ReactNode; description?: ReactNode; children?: ReactNode; footer?: ReactNode; wide?: boolean }

export function Dialog({ open, onClose, title, description, children, footer, wide }: DialogProps) {
  const ref = useModal(open, onClose)
  if (!open) return null
  return createPortal(
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={ref} className={cx('dialog', wide && 'dialog--wide')} role="dialog" aria-modal="true" aria-labelledby="dialog-title">
        <div className="dialog__head">
          <div style={{ flex: 1 }}>
            <h2 id="dialog-title">{title}</h2>
            {description && <p>{description}</p>}
          </div>
          <Button variant="ghost" size="sm" iconOnly icon={<X />} onClick={onClose} data-close>Schließen</Button>
        </div>
        {children}
        {footer && <div className="dialog__foot">{footer}</div>}
      </div>
    </div>,
    document.body,
  )
}

/** Seitenpanel von rechts, für Formulare neben dem Kontext. */
export function Drawer({ open, onClose, title, description, children, footer }: Omit<DialogProps, 'wide'>) {
  const ref = useModal(open, onClose)
  if (!open) return null
  return createPortal(
    <>
      <div className="drawer-overlay" onMouseDown={onClose} />
      <div ref={ref} className="drawer" role="dialog" aria-modal="true" aria-labelledby="drawer-title">
        <div className="drawer__head">
          <div style={{ flex: 1 }}>
            <h2 id="drawer-title">{title}</h2>
            {description && <p>{description}</p>}
          </div>
          <Button variant="ghost" size="sm" iconOnly icon={<X />} onClick={onClose} data-close>Schließen</Button>
        </div>
        <div className="drawer__body">{children}</div>
        {footer && <div className="drawer__foot">{footer}</div>}
      </div>
    </>,
    document.body,
  )
}
