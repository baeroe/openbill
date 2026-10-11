import { Monitor, Moon, Sun } from 'lucide-react'
import { useSessionStore, type Theme } from '@/store/sessionStore'
import { cx } from '@/ui/cx'

const options: { id: Theme; label: string; icon: typeof Sun }[] = [
  { id: 'light', label: 'Helles Design', icon: Sun },
  { id: 'dark', label: 'Dunkles Design', icon: Moon },
  { id: 'system', label: 'Systemeinstellung', icon: Monitor },
]

export function ThemeToggle() {
  const { theme, setTheme } = useSessionStore()
  return (
    <div className="inline-flex w-fit rounded-[5px] border border-line bg-sheet p-0.5">
      {options.map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          type="button"
          aria-label={label}
          title={label}
          aria-pressed={theme === id}
          onClick={() => setTheme(id)}
          className={cx('grid size-7 place-items-center rounded-[3px] transition-colors', theme === id ? 'bg-ink/8 text-ink' : 'text-faint hover:text-ink')}
        >
          <Icon size={14} />
        </button>
      ))}
    </div>
  )
}
