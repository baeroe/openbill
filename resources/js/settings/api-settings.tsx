import { ExternalLink, KeyRound, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { abilityKey, revokeToken, useTokens, type TokenRow } from '@/api/tokens';
import { Badge, Button, buttonClass, CardHead, ConfirmDialog, EmptyState, ErrorState, ListSkeleton } from '@/components/ui';
import { errorMessage } from '@/lib/api';
import { formatDate } from '@/lib/format';
import { t } from '@/lib/i18n';
import { toast } from '@/lib/toast';
import { SettingsCard } from './settings-card';
import { SetupSnippets } from './setup-snippets';
import { TokenDialog } from './token-dialog';

/** Settings → API & MCP: the own tokens, setup snippets for agents and the link to the REST reference. */
export function ApiSettings({ mcpUrl, apiDocsUrl }: { mcpUrl: string; apiDocsUrl: string }) {
    const tokens = useTokens();
    const [creating, setCreating] = useState(false);
    const [revoking, setRevoking] = useState<TokenRow | null>(null);
    const [pending, setPending] = useState(false);

    const confirmRevoke = async () => {
        if (!revoking) return;
        setPending(true);
        try {
            await revokeToken(revoking.id);
            toast.success(t('tokens.revoked', { name: revoking.name }));
        } catch (error) {
            toast.error(errorMessage(error));
        } finally {
            setPending(false);
            setRevoking(null);
        }
    };

    return (
        <div className="grid gap-6">
            <SettingsCard flush>
                <div className="px-5 pt-5">
                    <CardHead
                        title={t('tokens.title')}
                        description={t('tokens.text')}
                        actions={
                            <Button size="sm" variant="soft" icon={<KeyRound />} onClick={() => setCreating(true)}>
                                {t('tokens.new')}
                            </Button>
                        }
                    />
                </div>
                {tokens.error ? (
                    <ErrorState error={tokens.error} onRetry={() => void tokens.mutate()} />
                ) : !tokens.data ? (
                    <ListSkeleton rows={2} />
                ) : tokens.data.length === 0 ? (
                    <div className="px-5 pb-5">
                        <EmptyState compact icon={<KeyRound />} title={t('tokens.empty')}>
                            {t('tokens.empty_text')}
                        </EmptyState>
                    </div>
                ) : (
                    <ul className="m-0 grid list-none gap-0.5 px-2 pb-2">
                        {tokens.data.map((token) => (
                            <li key={token.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-md px-3 py-2.5 hover:bg-surface">
                                <span className="grid min-w-0 gap-1">
                                    <span className="truncate font-strong">{token.name}</span>
                                    <span className="flex flex-wrap gap-1">
                                        {token.is_toolkit ? (
                                            <Badge plain tone="accent">
                                                {t('tokens.toolkit', { template: token.template_name ?? '' })}
                                            </Badge>
                                        ) : (
                                            token.abilities.map((ability) => (
                                                <Badge key={ability} plain>
                                                    {t(`tokens.ability.${abilityKey(ability)}`)}
                                                </Badge>
                                            ))
                                        )}
                                    </span>
                                    <span className="text-sm text-muted">
                                        {t('tokens.created_on', { date: formatDate(token.created_at) })} ·{' '}
                                        {token.last_used_at ? t('tokens.last_used', { date: formatDate(token.last_used_at) }) : t('tokens.never_used')}
                                    </span>
                                </span>
                                <Button variant="ghost" size="sm" iconOnly icon={<Trash2 />} onClick={() => setRevoking(token)}>
                                    {t('tokens.revoke_named', { name: token.name })}
                                </Button>
                            </li>
                        ))}
                    </ul>
                )}
            </SettingsCard>

            <SettingsCard>
                <CardHead title={t('mcp.setup_title')} description={t('mcp.setup_text', { url: mcpUrl })} />
                <SetupSnippets url={mcpUrl} />
            </SettingsCard>

            <SettingsCard>
                <CardHead
                    title={t('api.docs_title')}
                    description={t('api.docs_text')}
                    actions={
                        <a href={apiDocsUrl} target="_blank" rel="noreferrer" className={buttonClass({ size: 'sm', variant: 'soft' })}>
                            <ExternalLink aria-hidden />
                            {t('api.docs_link')}
                        </a>
                    }
                />
            </SettingsCard>

            {creating && <TokenDialog mcpUrl={mcpUrl} onClose={() => setCreating(false)} />}
            <ConfirmDialog
                open={revoking !== null}
                onClose={() => setRevoking(null)}
                onConfirm={() => void confirmRevoke()}
                title={t('tokens.revoke_title', { name: revoking?.name ?? '' })}
                description={t('tokens.revoke_text')}
                confirmLabel={t('tokens.revoke')}
                pending={pending}
                danger
            />
        </div>
    );
}
