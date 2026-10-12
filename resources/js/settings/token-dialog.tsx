import { Check, Copy, KeyRound } from 'lucide-react';
import { useState } from 'react';
import { abilityKey, createToken, TOKEN_ABILITIES, type NewToken, type TokenAbility } from '@/api/tokens';
import { copyText } from '@/api/users';
import { Button, Checkbox, Dialog, TextInput } from '@/components/ui';
import { ApiError, errorMessage } from '@/lib/api';
import { t } from '@/lib/i18n';
import { toast } from '@/lib/toast';
import { SetupSnippets } from './setup-snippets';

/** New token: name and abilities → the token, shown this one time, with the setup snippets filled in. */
export function TokenDialog({ mcpUrl, onClose }: { mcpUrl: string; onClose(): void }) {
    const [name, setName] = useState('');
    const [abilities, setAbilities] = useState<TokenAbility[]>(['mcp']);
    const [errors, setErrors] = useState<{ name?: string; abilities?: string }>({});
    const [pending, setPending] = useState(false);
    const [created, setCreated] = useState<NewToken | null>(null);
    const [copied, setCopied] = useState(false);

    const toggle = (ability: TokenAbility, on: boolean) =>
        setAbilities((current) => (on ? [...current, ability] : current.filter((item) => item !== ability)));

    const submit = async () => {
        if (abilities.length === 0) {
            setErrors({ abilities: t('tokens.no_ability') });
            return;
        }
        setPending(true);
        try {
            // keep the order of the list, whatever order they were ticked in
            setCreated(await createToken(name.trim(), TOKEN_ABILITIES.filter((ability) => abilities.includes(ability))));
            setErrors({});
        } catch (error) {
            if (error instanceof ApiError && error.status === 422) {
                const fields = error.fieldErrors();
                setErrors({ name: fields.name, abilities: Object.entries(fields).find(([path]) => path.startsWith('abilities'))?.[1] });
            } else {
                toast.error(errorMessage(error));
            }
        } finally {
            setPending(false);
        }
    };

    const copy = async () => {
        if (created && (await copyText(created.plain_text_token))) {
            setCopied(true);
            toast.success(t('tokens.copied'));
        }
    };

    if (created) {
        return (
            <Dialog
                open
                wide
                onClose={onClose}
                title={t('tokens.created_title')}
                description={t('tokens.created_text')}
                footer={
                    <>
                        <Button variant="ghost" onClick={onClose}>
                            {t('common.close')}
                        </Button>
                        <Button variant="primary" icon={copied ? <Check /> : <Copy />} onClick={() => void copy()}>
                            {t('tokens.copy')}
                        </Button>
                    </>
                }
            >
                <div className="grid min-w-0 gap-5">
                    <TextInput label={t('tokens.token')} value={created.plain_text_token} readOnly className="font-mono" onFocus={(e) => e.currentTarget.select()} />
                    <SetupSnippets url={mcpUrl} token={created.plain_text_token} />
                </div>
            </Dialog>
        );
    }

    return (
        <Dialog
            open
            onClose={onClose}
            title={t('tokens.new')}
            description={t('tokens.text')}
            footer={
                <>
                    <Button variant="ghost" onClick={onClose}>
                        {t('common.cancel')}
                    </Button>
                    <Button variant="primary" icon={<KeyRound />} pending={pending} onClick={() => void submit()}>
                        {t('tokens.create')}
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
                <TextInput label={t('tokens.name')} value={name} data-autofocus placeholder={t('tokens.name_placeholder')} error={errors.name} onChange={(e) => setName(e.target.value)} />
                <fieldset className="m-0 grid gap-2.5 border-0 p-0">
                    <legend className="mb-2 text-sm font-medium text-muted">{t('tokens.abilities')}</legend>
                    {TOKEN_ABILITIES.map((ability) => (
                        <Checkbox
                            key={ability}
                            checked={abilities.includes(ability)}
                            onChange={(e) => toggle(ability, e.target.checked)}
                            label={
                                <span className="grid">
                                    <span>{t(`tokens.ability.${abilityKey(ability)}`)}</span>
                                    <span className="text-sm text-muted">{t(`tokens.ability_text.${abilityKey(ability)}`)}</span>
                                </span>
                            }
                        />
                    ))}
                    {errors.abilities && (
                        <span role="alert" className="text-xs text-bad">
                            {errors.abilities}
                        </span>
                    )}
                </fieldset>
            </form>
        </Dialog>
    );
}
