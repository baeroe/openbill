import { Copy, TextQuote } from 'lucide-react';
import { useRef } from 'react';
import { copyText } from '@/api/users';
import { useTextBlocks } from '@/api/master-data';
import type { DocumentDetail } from '@/api/types';
import { Button, Card, CardHead, Menu, MenuItem, Switch, Textarea, TextInput } from '@/components/ui';
import { t } from '@/lib/i18n';
import { toast } from '@/lib/toast';
import { focusAfterMenu } from '../focus';
import { insertAtSelection, toSlug } from '../ops';
import type { Draft } from '../types';

type Props = {
    draft: Draft;
    readOnly: boolean;
    /** data-path → message (field errors of the last save and compliance issues). */
    messages: Record<string, string>;
    update(fn: (draft: Draft) => Draft): void;
};

/** Title and Markdown text of a text document; clauses (text blocks of kind clause) go in at the cursor. */
export function TextBody({ draft, readOnly, messages, update }: Props) {
    const clauses = (useTextBlocks().data ?? []).filter((block) => block.kind === 'clause');
    const area = useRef<HTMLTextAreaElement>(null);

    const insert = (body: string) => {
        const element = area.current;
        const value = draft.body ?? '';
        const at = element ? { start: element.selectionStart, end: element.selectionEnd } : { start: value.length, end: value.length };
        const next = insertAtSelection(value, body.trim(), at.start, at.end);
        update((d) => ({ ...d, body: next.value }));
        // the caret goes behind the clause once React has rendered the new text
        focusAfterMenu(() => {
            area.current?.setSelectionRange(next.caret, next.caret);
            return area.current;
        });
    };

    return (
        <section className="grid min-w-0 gap-4">
            <TextInput
                label={t('editor.title_field')}
                value={draft.title ?? ''}
                disabled={readOnly}
                path="document.title"
                error={messages['document.title']}
                placeholder={t('editor.text_title_placeholder')}
                onChange={(e) => update((d) => ({ ...d, title: e.target.value }))}
            />
            <Textarea
                ref={area}
                label={t('editor.body')}
                aside={
                    !readOnly && (
                        <Menu
                            trigger={
                                <Button variant="ghost" size="sm" icon={<TextQuote />} disabled={clauses.length === 0}>
                                    {t('editor.insert_clause')}
                                </Button>
                            }
                        >
                            {clauses.map((block) => (
                                <MenuItem key={block.id} onSelect={() => insert(block.body)}>
                                    <span className="grid min-w-0">
                                        <span>{block.name}</span>
                                        <span className="max-w-72 truncate text-xs text-muted">{block.body.split('\n')[0]}</span>
                                    </span>
                                </MenuItem>
                            ))}
                        </Menu>
                    )
                }
                value={draft.body ?? ''}
                disabled={readOnly}
                rows={18}
                className="min-h-72 font-mono text-sm"
                path="document.body"
                error={messages['document.body']}
                placeholder={t('editor.body_placeholder')}
                hint={readOnly ? undefined : t('editor.body_hint')}
                spellCheck
                onChange={(e) => update((d) => ({ ...d, body: e.target.value }))}
            />
        </section>
    );
}

function LinkRow({ label, hint, url }: { label: string; hint: string; url: string }) {
    const copy = async () => {
        if (await copyText(url)) toast.success(t('editor.link_copied'));
        else toast.error(t('editor.link_copy_failed'));
    };
    return (
        <div className="grid gap-1.5">
            <span className="text-sm font-medium text-muted">{label}</span>
            <div className="flex items-center gap-2">
                <TextInput aria-label={label} value={url} readOnly className="font-mono" wrapClassName="min-w-0 flex-1" onFocus={(e) => e.currentTarget.select()} />
                <Button iconOnly icon={<Copy />} onClick={() => void copy()}>
                    {t('editor.link_copy')}
                </Button>
            </div>
            <span className="text-xs text-muted">{hint}</span>
        </div>
    );
}

/** Short name and the public flag; once finalized and public, the links to copy. */
export function PublishCard({ draft, document, readOnly, messages, update }: Props & { document: DocumentDetail }) {
    return (
        <Card tinted className="grid gap-4" aria-labelledby="publish-heading" data-path="document.is_public">
            <CardHead titleId="publish-heading" title={t('editor.publish')} description={t('editor.publish_text')} />
            <div className="grid gap-4 sm:grid-cols-2">
                <TextInput
                    label={t('editor.slug')}
                    value={draft.slug ?? ''}
                    disabled={readOnly}
                    path="document.slug"
                    error={messages['document.slug']}
                    placeholder="agb"
                    hint={readOnly ? undefined : t('editor.slug_hint')}
                    className="font-mono"
                    autoCapitalize="off"
                    autoCorrect="off"
                    onChange={(e) => update((d) => ({ ...d, slug: toSlug(e.target.value) }))}
                    onBlur={(e) => update((d) => (d.slug === toSlug(e.target.value, true) ? d : { ...d, slug: toSlug(e.target.value, true) }))}
                />
                <div className="grid content-start gap-1.5">
                    <span className="text-sm font-medium text-muted">{t('editor.public')}</span>
                    <Switch
                        label={draft.is_public ? t('editor.public_on') : t('editor.public_off')}
                        checked={draft.is_public ?? false}
                        disabled={readOnly}
                        className="h-control"
                        onChange={(e) => update((d) => ({ ...d, is_public: e.target.checked }))}
                    />
                    {messages['document.is_public'] && <span className="text-xs text-bad">{messages['document.is_public']}</span>}
                </div>
            </div>
            {document.public_url && <LinkRow label={t('editor.link_version')} hint={t('editor.link_version_hint')} url={document.public_url} />}
            {document.public_latest_url && <LinkRow label={t('editor.link_latest')} hint={t('editor.link_latest_hint')} url={document.public_latest_url} />}
        </Card>
    );
}
