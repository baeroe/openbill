/** Springt zum Feld mit data-path und fokussiert die erste Eingabe darin. */
export function jumpTo(path: string) {
  const el = document.querySelector<HTMLElement>(`[data-path="${CSS.escape(path)}"]`)
  if (!el) return false
  el.scrollIntoView({ behavior: 'smooth', block: 'center' })
  const input = el.matches('input, select, textarea') ? el : el.querySelector<HTMLElement>('input, select, textarea, button')
  setTimeout(() => input?.focus({ preventScroll: true }), 250)
  el.classList.remove('flash')
  void el.offsetWidth
  el.classList.add('flash')
  return true
}
