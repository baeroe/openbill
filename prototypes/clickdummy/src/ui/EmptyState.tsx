import type { ReactNode } from 'react'

export function EmptyState({ title, text, action }: { title: string; text?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-start gap-2 rounded-[3px] border border-dashed border-line-strong px-6 py-10">
      <p className="font-medium">{title}</p>
      {text && <p className="max-w-prose text-sm text-muted">{text}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  )
}
