import { Copy, RotateCcw, UserMinus, UserPlus, X } from 'lucide-react';
import { router } from '@inertiajs/react';
import { useState } from 'react';
import { changeUserRole, copyText, disableUser, enableUser, revokeInvitation, useUsers, type UserRow } from '@/api/users';
import { Avatar, Badge, Button, CardHead, ConfirmDialog, ErrorState, ListSkeleton, SelectControl, cx } from '@/components/ui';
import { SettingsCard } from './settings-card';
import { errorMessage } from '@/lib/api';
import { formatDate } from '@/lib/format';
import { t } from '@/lib/i18n';
import { toast } from '@/lib/toast';
import type { UserRole } from '@/types';
import { InviteDialog } from './invite-dialog';

const ROW = 'grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 rounded-md px-3 py-2.5 hover:bg-surface sm:grid-cols-[auto_minmax(0,1fr)_10rem_2.5rem]';

export function UserSettings({ canManage }: { canManage: boolean }) {
    const users = useUsers();
    const [inviting, setInviting] = useState(false);
    const [disabling, setDisabling] = useState<UserRow | null>(null);
    const [pending, setPending] = useState(false);
    const [demotingSelf, setDemotingSelf] = useState<UserRow | null>(null);

    const run = async (task: () => Promise<unknown>, success?: string) => {
        try {
            await task();
            if (success) toast.success(success);
        } catch (error) {
            toast.error(errorMessage(error));
        }
    };

    const changeRole = (user: UserRow, role: UserRole) => {
        // stepping down yourself ends your user management: ask first (the select stays until confirmed)
        if (user.is_self && role === 'member') {
            setDemotingSelf(user);
            return;
        }
        void run(() => changeUserRole(user.id, role), t('users.role_changed', { name: user.name }));
    };

    const confirmDemoteSelf = async () => {
        if (!demotingSelf) return;
        setPending(true);
        await run(() => changeUserRole(demotingSelf.id, 'member'), t('users.role_changed', { name: demotingSelf.name }));
        setPending(false);
        setDemotingSelf(null);
        router.reload({ only: ['can_manage_users'] });
    };

    const confirmDisable = async () => {
        if (!disabling) return;
        setPending(true);
        await run(() => disableUser(disabling.id), t('users.disabled', { name: disabling.name }));
        setPending(false);
        setDisabling(null);
    };

    return (
        <div className="grid gap-6">
            <SettingsCard flush>
                <div className="px-5 pt-5">
                    <CardHead
                        title={t('settings.section.users')}
                        description={canManage ? t('users.text_owner') : t('users.text_member')}
                        actions={
                            canManage && (
                                <Button size="sm" variant="soft" icon={<UserPlus />} onClick={() => setInviting(true)}>
                                    {t('users.invite')}
                                </Button>
                            )
                        }
                    />
                </div>
                {users.error ? (
                    <ErrorState error={users.error} onRetry={() => void users.mutate()} />
                ) : !users.data ? (
                    <ListSkeleton rows={2} />
                ) : (
                    <ul className="m-0 grid list-none gap-0.5 px-2 pb-2">
                        {users.data.users.map((user) => (
                            <li key={user.id} className={cx(ROW, user.disabled_at && 'opacity-70')}>
                                {/* below 720 px: avatar left over two rows, name and action in the first, role below the name */}
                                <span className="row-span-2 self-start sm:row-span-1 sm:self-center">
                                    <Avatar name={user.name} size="sm" />
                                </span>
                                <span className="col-start-2 row-start-1 grid min-w-0 gap-0.5 sm:col-start-auto sm:row-start-auto">
                                    <span className="flex min-w-0 items-center gap-2 font-strong">
                                        <span className="truncate">{user.name}</span>
                                        {user.is_self && <span className="font-normal text-muted">· {t('users.you')}</span>}
                                        {user.disabled_at && <Badge plain>{t('users.disabled_badge')}</Badge>}
                                    </span>
                                    <span className="truncate text-sm text-muted">{user.email}</span>
                                </span>
                                {canManage ? (
                                    <SelectControl
                                        aria-label={t('users.role_of', { name: user.name })}
                                        value={user.role}
                                        className="col-start-2 row-start-2 w-40 justify-self-start sm:col-start-auto sm:row-start-auto sm:w-auto sm:justify-self-stretch"
                                        onChange={(e) => changeRole(user, e.target.value as UserRole)}
                                    >
                                        <option value="member">{t('users.role.member')}</option>
                                        <option value="owner">{t('users.role.owner')}</option>
                                    </SelectControl>
                                ) : (
                                    <Badge plain tone={user.role === 'owner' ? 'ink' : 'neutral'} className="col-start-2 row-start-2 justify-self-start sm:col-start-auto sm:row-start-auto sm:justify-self-end">
                                        {t(`users.role.${user.role}`)}
                                    </Badge>
                                )}
                                <span className="col-start-3 row-start-1 flex justify-end sm:col-start-auto sm:row-start-auto">
                                    {canManage && !user.is_self && !user.disabled_at && (
                                        <Button variant="ghost" size="sm" iconOnly icon={<UserMinus />} onClick={() => setDisabling(user)}>
                                            {t('users.disable_named', { name: user.name })}
                                        </Button>
                                    )}
                                    {canManage && user.disabled_at && (
                                        <Button variant="ghost" size="sm" iconOnly icon={<RotateCcw />} onClick={() => void run(() => enableUser(user.id), t('users.enabled', { name: user.name }))}>
                                            {t('users.enable_named', { name: user.name })}
                                        </Button>
                                    )}
                                </span>
                            </li>
                        ))}
                    </ul>
                )}
            </SettingsCard>

            {users.data && users.data.invitations.length > 0 && (
                <SettingsCard flush>
                    <div className="px-5 pt-5">
                        <CardHead title={t('users.invitations')} description={t('users.invitations_text')} />
                    </div>
                    <ul className="m-0 grid list-none gap-0.5 px-2 pb-2">
                        {users.data.invitations.map((invitation) => (
                            <li key={invitation.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-md px-3 py-2.5 hover:bg-surface">
                                <span className="grid min-w-0 gap-0.5">
                                    <span className="truncate font-strong">{invitation.email}</span>
                                    <span className="text-sm text-muted">
                                        {t(`users.role.${invitation.role}`)} · {t('users.valid_until', { date: formatDate(invitation.expires_at) })}
                                    </span>
                                </span>
                                {canManage && invitation.link && (
                                    <span className="flex gap-0.5">
                                        <Button
                                            size="sm"
                                            variant="ghost"
                                            icon={<Copy />}
                                            onClick={() => void copyText(invitation.link!).then((ok) => (ok ? toast.success(t('users.link_copied')) : toast.info(invitation.link!)))}
                                        >
                                            {t('users.copy_link')}
                                        </Button>
                                        <Button size="sm" variant="ghost" iconOnly icon={<X />} onClick={() => void run(() => revokeInvitation(invitation.id), t('users.revoked', { email: invitation.email }))}>
                                            {t('users.revoke_named', { email: invitation.email })}
                                        </Button>
                                    </span>
                                )}
                            </li>
                        ))}
                    </ul>
                </SettingsCard>
            )}

            {inviting && <InviteDialog onClose={() => setInviting(false)} />}
            <ConfirmDialog
                open={demotingSelf !== null}
                onClose={() => setDemotingSelf(null)}
                onConfirm={() => void confirmDemoteSelf()}
                title={t('users.demote_self_title')}
                description={t('users.demote_self_text')}
                confirmLabel={t('users.demote_self')}
                pending={pending}
                danger
            />
            <ConfirmDialog
                open={disabling !== null}
                onClose={() => setDisabling(null)}
                onConfirm={() => void confirmDisable()}
                title={t('users.disable_title', { name: disabling?.name ?? '' })}
                description={t('users.disable_text')}
                confirmLabel={t('users.disable')}
                pending={pending}
                danger
            />
        </div>
    );
}
