import { Check, Copy, UserPlus } from 'lucide-react';
import { useState } from 'react';
import { copyText, inviteUser, type InvitationRow } from '@/api/users';
import { Button, Dialog, Select, TextInput } from '@/components/ui';
import { ApiError, errorMessage } from '@/lib/api';
import { t } from '@/lib/i18n';
import { toast } from '@/lib/toast';
import type { UserRole } from '@/types';

/** Invite: email + role → the copyable link (no mail is sent). */
export function InviteDialog({ onClose }: { onClose(): void }) {
    const [email, setEmail] = useState('');
    const [role, setRole] = useState<UserRole>('member');
    const [error, setError] = useState<string | undefined>();
    const [pending, setPending] = useState(false);
    const [created, setCreated] = useState<InvitationRow | null>(null);
    const [copied, setCopied] = useState(false);

    const submit = async () => {
        setPending(true);
        try {
            setCreated(await inviteUser(email.trim(), role));
            setError(undefined);
        } catch (e) {
            if (e instanceof ApiError && e.status === 422) setError(e.fieldErrors().email ?? errorMessage(e));
            else toast.error(errorMessage(e));
        } finally {
            setPending(false);
        }
    };

    const copy = async () => {
        if (created?.link && (await copyText(created.link))) {
            setCopied(true);
            toast.success(t('users.link_copied'));
        }
    };

    if (created) {
        return (
            <Dialog
                open
                onClose={onClose}
                title={t('users.invited_title')}
                description={t('users.invited_text', { email: created.email })}
                footer={
                    <>
                        <Button variant="ghost" onClick={onClose}>
                            {t('common.close')}
                        </Button>
                        <Button variant="primary" icon={copied ? <Check /> : <Copy />} onClick={() => void copy()}>
                            {t('users.copy_link')}
                        </Button>
                    </>
                }
            >
                <TextInput label={t('users.link')} value={created.link ?? ''} readOnly className="font-mono" onFocus={(e) => e.currentTarget.select()} hint={t('users.link_hint')} />
            </Dialog>
        );
    }

    return (
        <Dialog
            open
            onClose={onClose}
            title={t('users.invite_title')}
            description={t('users.invite_text')}
            footer={
                <>
                    <Button variant="ghost" onClick={onClose}>
                        {t('common.cancel')}
                    </Button>
                    <Button variant="primary" icon={<UserPlus />} pending={pending} onClick={() => void submit()}>
                        {t('users.create_link')}
                    </Button>
                </>
            }
        >
            <form
                noValidate
                className="grid gap-4"
                onSubmit={(e) => {
                    e.preventDefault();
                    void submit();
                }}
            >
                <TextInput label={t('users.email')} type="email" value={email} data-autofocus placeholder="name@example.com" error={error} onChange={(e) => setEmail(e.target.value)} />
                <Select label={t('users.role')} value={role} onChange={(e) => setRole(e.target.value as UserRole)}>
                    <option value="member">{t('users.role_member_text')}</option>
                    <option value="owner">{t('users.role_owner_text')}</option>
                </Select>
            </form>
        </Dialog>
    );
}
