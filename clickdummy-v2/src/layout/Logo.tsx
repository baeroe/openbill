/** Bildmarke: ein Blatt mit umgeknickter Ecke und Haken. */
export function Logo() {
  return (
    <span className="brand__mark" aria-hidden>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M6 3h8l4 4v14H6z" />
        <path d="M9.5 13.5l2 2 3.5-4" />
      </svg>
    </span>
  )
}
