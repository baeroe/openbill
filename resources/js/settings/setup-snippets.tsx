import { Check, Copy } from 'lucide-react';
import { useState } from 'react';
import { copyText } from '@/api/users';
import { Button, Tabs } from '@/components/ui';
import { t } from '@/lib/i18n';
import { toast } from '@/lib/toast';
import { SETUP_CLIENTS, setupSnippet, type SetupClient } from './mcp-setup';

/** Setup snippets for Claude Code, Codex and JSON; the real token only right after it was created. */
export function SetupSnippets({ url, token }: { url: string; token?: string }) {
    const [client, setClient] = useState<SetupClient>('claude');
    const [copied, setCopied] = useState(false);
    const snippet = setupSnippet(client, url, token);

    const copy = async () => {
        if (await copyText(snippet)) {
            setCopied(true);
            toast.success(t('mcp.copied'));
        } else {
            toast.info(snippet);
        }
    };

    return (
        <div className="grid min-w-0 gap-3">
            {/* the wrapper keeps the pill at its own width (a grid item would stretch it) */}
            <div>
                <Tabs
                    label={t('mcp.clients')}
                    value={client}
                    onChange={(value) => {
                        setClient(value);
                        setCopied(false);
                    }}
                    items={SETUP_CLIENTS.map((value) => ({ value, label: t(`mcp.client.${value}`) }))}
                />
            </div>
            {/* the button sits next to the scrolling block, so long lines never run under it */}
            <div className="flex min-w-0 items-start rounded-md bg-surface-2">
                <pre className="m-0 min-w-0 flex-1 overflow-x-auto p-3 font-mono text-sm whitespace-pre">{snippet}</pre>
                <Button size="sm" variant="ghost" iconOnly icon={copied ? <Check /> : <Copy />} className="m-1.5" onClick={() => void copy()}>
                    {t('mcp.copy')}
                </Button>
            </div>
            <p className="m-0 text-sm text-muted">
                {t(`mcp.hint.${client}`)}
                {token ? '' : ` ${t('mcp.token_placeholder')}`}
            </p>
        </div>
    );
}
