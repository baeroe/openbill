import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { ChevronLeft } from 'lucide-react'

export function PageHeader({ title, description, actions, back }: { title: ReactNode; description?: ReactNode; actions?: ReactNode; back?: { to: string; label: string } }) {
  return (
    <header className="page-head">
      <div className="page-head__text">
        {back && <Link className="back" to={back.to}><ChevronLeft />{back.label}</Link>}
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      <span className="spacer" />
      {actions && <div className="row row--wrap">{actions}</div>}
    </header>
  )
}
