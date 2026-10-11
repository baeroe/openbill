import type { ReactNode } from 'react'

export function PageHeader({ title, meta, actions, children }: { title: ReactNode; meta?: ReactNode; actions?: ReactNode; children?: ReactNode }) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
      <div className="min-w-0">
        <h1 className="font-cond text-[28px] leading-tight font-semibold tracking-[-0.01em]">{title}</h1>
        {meta && <div className="mt-1 text-sm text-muted">{meta}</div>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      {children}
    </header>
  )
}
