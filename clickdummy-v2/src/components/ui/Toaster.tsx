import { AlertCircle, Check, Info } from 'lucide-react'
import { useToastStore } from '@/store/toast'
import { cx } from './cx'

export function Toaster() {
  const toasts = useToastStore((s) => s.toasts)
  const dismiss = useToastStore((s) => s.dismiss)
  return (
    <div className="toasts" role="status" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={cx('toast', t.tone === 'error' && 'toast--error')}>
          {t.tone === 'success' ? <Check /> : t.tone === 'error' ? <AlertCircle /> : <Info />}
          <span className="toast__text">{t.message}</span>
          {t.action && <button type="button" className="btn btn--sm" onClick={() => { t.action!.run(); dismiss(t.id) }}>{t.action.label}</button>}
        </div>
      ))}
    </div>
  )
}
