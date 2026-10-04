import { useEffect } from 'react'
import { useLocation } from 'react-router'

/** Springt beim Laden zu dem Element, dessen ID im URL-Hash steht (z. B. aus der Prüfanzeige). */
export function useHashFocus() {
  const { hash } = useLocation()
  useEffect(() => {
    if (!hash) return
    const t = setTimeout(() => {
      const el = document.getElementById(decodeURIComponent(hash.slice(1)))
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      el?.focus({ preventScroll: true })
    }, 80)
    return () => clearTimeout(t)
  }, [hash])
}
