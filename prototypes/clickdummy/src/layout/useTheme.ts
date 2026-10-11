import { useEffect } from 'react'
import { useSessionStore } from '@/store/sessionStore'

/** Setzt data-theme auf <html> gemäß Einstellung (System folgt prefers-color-scheme). */
export function useApplyTheme() {
  const theme = useSessionStore((s) => s.theme)
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const apply = () => {
      document.documentElement.dataset.theme = theme === 'system' ? (mq.matches ? 'dark' : 'light') : theme
    }
    apply()
    mq.addEventListener('change', apply)
    return () => mq.removeEventListener('change', apply)
  }, [theme])
}
