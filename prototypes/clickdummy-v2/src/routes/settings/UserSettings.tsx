import { useState } from 'react'
import { Trash2, UserPlus, UsersRound } from 'lucide-react'
import { Badge, Button, Dialog, EmptyState, ListSkeleton, Select, TextInput } from '@/components/ui'
import type { User } from '@/domain/types'
import { useDeleteUser, useInviteUser, useSettings } from '@/hooks/useSettings'
import { QueryGate } from '@/layout/RouteState'
import { toast } from '@/store/toast'

const ROLE_LABELS: Record<User['role'], string> = { owner: 'Inhaber', member: 'Mitglied' }
const initials = (name: string) => name.split(/\s+/).map((p) => p[0]).join('').slice(0, 2).toUpperCase()

export function UserSettings() {
  const query = useSettings()
  const [inviting, setInviting] = useState(false)
  const del = useDeleteUser()
  const invite = useInviteUser()

  return (
    <div className="stack stack--lg enter">
      <section className="card card--flush">
        <div className="card__head settings-list-head">
          <div><h2 className="card__title">Benutzer</h2><p className="card__desc">Alle Benutzer arbeiten in derselben Organisation.</p></div>
          <span className="spacer" />
          <Button size="sm" variant="soft" icon={<UserPlus />} onClick={() => setInviting(true)}>Einladen</Button>
        </div>
        <QueryGate query={query} loading={<ListSkeleton rows={2} />}>
          {(s) => s.users.length === 0 ? (
            <EmptyState icon={<UsersRound />} title="Noch niemand eingeladen" actions={<Button variant="primary" icon={<UserPlus />} onClick={() => setInviting(true)}>Einladen</Button>} />
          ) : (
            <ul className="list settings-list">
              {s.users.map((u) => (
                <li key={u.id} className="list__row settings-row settings-row--user">
                  <span className="avatar">{initials(u.name)}</span>
                  <span className="settings-row__main settings-row__main--static">
                    <span className="list__primary">{u.name}</span>
                    <span className="list__secondary">{u.email}</span>
                  </span>
                  <Badge plain tone={u.role === 'owner' ? 'ink' : 'neutral'}>{ROLE_LABELS[u.role]}</Badge>
                  <span className="settings-row__actions">
                    {u.role !== 'owner' && (
                      <Button variant="ghost" size="sm" iconOnly icon={<Trash2 />} onClick={() => del.mutate(u.id, {
                        onSuccess: () => toast.success(`${u.name} entfernt`, { label: 'Rückgängig', run: () => invite.mutate({ name: u.name, email: u.email, role: u.role }) }),
                        onError: (e) => toast.error(e.message),
                      })}>{`${u.name} entfernen`}</Button>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </QueryGate>
      </section>
      <p className="muted">Rechte und Rollen sind im Klickdummy nur angedeutet. In der echten App bekommt jede Einladung einen Link per E-Mail.</p>
      {inviting && <InviteDialog onClose={() => setInviting(false)} />}
    </div>
  )
}

function InviteDialog({ onClose }: { onClose(): void }) {
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<User['role']>('member')
  const [touched, setTouched] = useState(false)
  const invite = useInviteUser()
  const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
  const submit = () => {
    setTouched(true)
    if (!valid) return
    const name = email.split('@')[0].replace(/[._-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
    invite.mutate({ name, email: email.trim(), role }, {
      onSuccess: () => { toast.success('Einladung verschickt (simuliert)'); onClose() },
      onError: (e) => toast.error(e.message),
    })
  }
  return (
    <Dialog open onClose={onClose} title="Benutzer einladen" description="Die Person bekommt einen Link und legt ihr Passwort selbst fest."
      footer={<><Button variant="ghost" onClick={onClose}>Abbrechen</Button><Button variant="primary" icon={<UserPlus />} pending={invite.isPending} onClick={submit}>Einladung senden</Button></>}>
      <form className="stack" onSubmit={(e) => { e.preventDefault(); submit() }}>
        <TextInput label="E-Mail" type="email" value={email} data-autofocus placeholder="name@firma.de" error={touched && !valid ? 'Gib eine gültige E-Mail-Adresse ein.' : undefined} onChange={(e) => setEmail(e.target.value)} />
        <Select label="Rolle" value={role} onChange={(e) => setRole(e.target.value as User['role'])}>
          <option value="member">Mitglied: Dokumente und Kunden bearbeiten</option>
          <option value="owner">Inhaber: zusätzlich Einstellungen und Benutzer</option>
        </Select>
      </form>
    </Dialog>
  )
}
