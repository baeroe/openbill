import { useEffect } from 'react'
import { useUiStore } from '@/store/ui'

/** Setzt data-theme am <html> aus der Einstellung (System folgt prefers-color-scheme). */
export function useApplyTheme() {
  const theme = useUiStore((s) => s.theme)
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const apply = () => {
      const dark = theme === 'dark' || (theme === 'system' && mq.matches)
      document.documentElement.dataset.theme = dark ? 'dark' : 'light'
    }
    apply()
    mq.addEventListener('change', apply)
    return () => mq.removeEventListener('change', apply)
  }, [theme])
}
