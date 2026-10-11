import { cx } from '@/ui/cx'

/** Wortmarke: ein Blatt mit Durchschlag dahinter. */
export function Logo({ className }: { className?: string }) {
  return (
    <span className={cx('inline-flex items-center gap-2', className)}>
      <svg width="20" height="22" viewBox="0 0 20 22" aria-hidden>
        <rect x="5" y="1" width="14" height="18" rx="1" fill="var(--copy-yellow)" stroke="var(--line-strong)" />
        <path d="M1 4.5h10l3 3V21H1z" fill="var(--sheet)" stroke="var(--ink)" strokeWidth="1.3" strokeLinejoin="round" />
        <path d="M4 12h7M4 15h5" stroke="var(--carbon)" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
      <span className="font-cond text-[19px] font-semibold tracking-[-0.02em]">openbill</span>
    </span>
  )
}
