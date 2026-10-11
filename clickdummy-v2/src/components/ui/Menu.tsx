import { useEffect, useRef, useState, type ReactNode } from 'react'
import { cx } from './cx'

/** Aufklappmenü. Schließt bei Klick außerhalb und mit Escape; Pfeiltasten wandern durch die Einträge. */
export function Menu({ trigger, children, align = 'right', placement = 'down' }: { trigger: (p: { open: boolean; toggle(): void; ref: React.Ref<HTMLButtonElement> }) => ReactNode; children: (close: () => void) => ReactNode; align?: 'left' | 'right'; placement?: 'down' | 'up' }) {
  const [open, setOpen] = useState(false)
  const wrap = useRef<HTMLDivElement>(null)
  const btn = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => { if (!wrap.current?.contains(e.target as Node)) setOpen(false) }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setOpen(false); btn.current?.focus() }
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault()
        const items = [...(wrap.current?.querySelectorAll<HTMLElement>('.menu__item:not(:disabled)') ?? [])]
        const i = items.indexOf(document.activeElement as HTMLElement)
        items[(i + (e.key === 'ArrowDown' ? 1 : items.length - 1) + (i < 0 && e.key === 'ArrowUp' ? 1 : 0)) % items.length]?.focus()
      }
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    requestAnimationFrame(() => wrap.current?.querySelector<HTMLElement>('.menu__item:not(:disabled)')?.focus())
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey) }
  }, [open])
  return (
    <div className="menu-wrap" ref={wrap}>
      {trigger({ open, toggle: () => setOpen((o) => !o), ref: btn })}
      {open && <div className={cx('menu', align === 'left' && 'menu--left', placement === 'up' && 'menu--up')} role="menu">{children(() => setOpen(false))}</div>}
    </div>
  )
}

export function MenuItem({ icon, children, danger, ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement> & { icon?: ReactNode; danger?: boolean }) {
  return <button type="button" role="menuitem" className={cx('menu__item', danger && 'menu__item--danger')} {...rest}>{icon}{children}</button>
}
