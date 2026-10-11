import type { Zone } from './PagedPreview'

/** Kleine Seitenskizze: zeigt, welcher Bereich der Seite gerade bearbeitet wird. */
export function ZoneMap({ active }: { active: Zone | null }) {
  const fill = (z: Zone) => (active === z ? 'var(--carbon)' : 'var(--line)')
  return (
    <svg width="26" height="34" viewBox="0 0 26 34" aria-hidden className="shrink-0">
      <rect x="0.5" y="0.5" width="25" height="33" rx="1.5" fill="var(--sheet)" stroke="var(--line-strong)" />
      <rect x="3" y="3" width="20" height="4" rx="0.5" fill={fill('header')} />
      <rect x="5" y="9.5" width="16" height="15" rx="0.5" fill={fill('body')} opacity={active === 'body' ? 1 : 0.7} />
      <rect x="3" y="27" width="20" height="4" rx="0.5" fill={fill('footer')} />
    </svg>
  )
}
