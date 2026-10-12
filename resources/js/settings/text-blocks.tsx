import { Pencil, Plus, TextQuote, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useTextBlocks } from '@/api/master-data';
import { deleteTextBlock, saveTextBlock, useDocumentTypes, type TextBlockInput } from '@/api/settings';
import type { TextBlockKind } from '@/api/types';
import { Badge, Button, CardHead, Drawer, EmptyState, ErrorState, ListSkeleton, Select, Textarea, TextInput } from '@/components/ui';
import { SettingsCard } from './settings-card';
import { ApiError, errorMessage } from '@/lib/api';
import { t } from '@/lib/i18n';
import { scheduleDelete, usePendingDeletes } from '@/lib/pending-delete';
import { toast } from '@/lib/toast';

const KINDS: TextBlockKind[] = ['intro', 'closing', 'payment', 'note'];
const PLACEHOLDERS = ['{{ contact.first_name }}', '{{ customer.name }}', '{{ document.number }}', '{{ document.due_date | date }}', '{{ document.gross_total | money }}'];

export function TextBlockSettings() {
    const blocks = useTextBlocks();
    const documentTypes = useDocumentTypes();
    const pending = usePendingDeletes();
    const [editing, setEditing] = useState<{ input: TextBlockInput; id?: string } | null>(null);
    const visible = (blocks.data ?? []).filter((block) => !pending.has(block.id));
    const create = () => setEditing({ input: { name: '', kind: 'intro', body: '' } });

    const remove = (id: string, name: string) => {
        const handle = scheduleDelete(id, (options) => deleteTextBlock(id, options));
        toast.success(t('settings.block_deleted', { name }), {
            label: t('fields.undo'),
            run: () => {
                if (handle.undo()) toast.info(t('settings.restored', { label: name }));
            },
            onExpire: () => void handle.commit().catch((error: unknown) => toast.error(errorMessage(error))),
        });
    };

    return (
        <SettingsCard flush>
            <div className="px-5 pt-5">
                <CardHead
                    title={t('settings.section.text_blocks')}
                    description={t('settings.blocks_text')}
                    actions={
                        <Button size="sm" variant="soft" icon={<Plus />} onClick={create}>
                            {t('settings.block_add')}
                        </Button>
                    }
                />
            </div>
            {blocks.error ? (
                <ErrorState error={blocks.error} onRetry={() => void blocks.mutate()} />
            ) : !blocks.data ? (
                <ListSkeleton rows={4} />
            ) : visible.length === 0 ? (
                <EmptyState icon={<TextQuote />} title={t('settings.blocks_empty')} actions={<Button variant="primary" icon={<Plus />} onClick={create}>{t('settings.block_add')}</Button>}>
                    {t('settings.blocks_empty_text')}
                </EmptyState>
            ) : (
                <ul className="m-0 grid list-none gap-0.5 px-2 pb-2">
                    {visible.map((block) => {
                        const usedBy = (documentTypes.data ?? []).filter((setting) => setting.default_intro_block_id === block.id || setting.default_closing_block_id === block.id);
                        return (
                            <li key={block.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 rounded-md px-3 py-2.5 hover:bg-surface sm:grid-cols-[minmax(0,1fr)_auto_auto]">
                                <button type="button" className="grid min-w-0 gap-0.5 text-left" onClick={() => setEditing({ input: block, id: block.id })}>
                                    <span className="font-strong">{block.name}</span>
                                    <span className="truncate text-sm text-muted">{block.body.replace(/\n/g, ' ')}</span>
                                </button>
                                <span className="col-start-1 flex flex-wrap gap-1.5 sm:col-start-auto sm:justify-end">
                                    <Badge plain>{t(`text_block.kind.${block.kind}`)}</Badge>
                                    {usedBy.length > 0 && (
                                        <Badge plain tone="accent">
                                            {t('settings.block_default_for', { types: usedBy.map((setting) => t(`document_type.${setting.type}`)).join(', ') })}
                                        </Badge>
                                    )}
                                </span>
                                <span className="row-span-2 row-start-1 flex justify-end gap-0.5 sm:row-span-1 sm:row-start-auto">
                                    <Button variant="ghost" size="sm" iconOnly icon={<Pencil />} onClick={() => setEditing({ input: block, id: block.id })}>
                                        {t('settings.edit_named', { label: block.name })}
                                    </Button>
                                    <Button variant="ghost" size="sm" iconOnly icon={<Trash2 />} onClick={() => remove(block.id, block.name)}>
                                        {t('settings.delete_named', { label: block.name })}
                                    </Button>
                                </span>
                            </li>
                        );
                    })}
                </ul>
            )}
            {editing && <TextBlockDrawer initial={editing.input} id={editing.id} onClose={() => setEditing(null)} />}
        </SettingsCard>
    );
}

function TextBlockDrawer({ initial, id, onClose }: { initial: TextBlockInput; id?: string; onClose(): void }) {
    const [block, setBlock] = useState<TextBlockInput>({ name: initial.name, kind: initial.kind, body: initial.body });
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [pending, setPending] = useState(false);

    const submit = async () => {
        setPending(true);
        try {
            const saved = await saveTextBlock(block, id);
            toast.success(t('settings.block_saved', { name: saved.name }));
            onClose();
        } catch (error) {
            if (error instanceof ApiError && error.status === 422) setErrors(error.fieldErrors());
            else toast.error(errorMessage(error));
        } finally {
            setPending(false);
        }
    };

    return (
        <Drawer
            open
            onClose={onClose}
            title={id ? t('settings.block_edit') : t('settings.block_new')}
            footer={
                <>
                    <Button variant="ghost" onClick={onClose}>
                        {t('common.cancel')}
                    </Button>
                    <Button variant="primary" pending={pending} onClick={() => void submit()}>
                        {t('settings.save')}
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
                <TextInput label={t('settings.block_name')} value={block.name} data-autofocus placeholder={t('settings.block_name_placeholder')} error={errors.name} onChange={(e) => setBlock({ ...block, name: e.target.value })} />
                <Select label={t('settings.block_kind')} value={block.kind} error={errors.kind} onChange={(e) => setBlock({ ...block, kind: e.target.value as TextBlockKind })}>
                    {KINDS.map((kind) => (
                        <option key={kind} value={kind}>
                            {t(`text_block.kind.${kind}`)}
                        </option>
                    ))}
                </Select>
                <Textarea label={t('settings.block_body')} rows={7} value={block.body} error={errors.body} onChange={(e) => setBlock({ ...block, body: e.target.value })} />
                <div className="grid gap-2">
                    <span className="text-xs text-muted">{t('settings.block_placeholders')}</span>
                    <div className="flex flex-wrap gap-1.5">
                        {PLACEHOLDERS.map((placeholder) => (
                            <button
                                key={placeholder}
                                type="button"
                                onClick={() => setBlock({ ...block, body: `${block.body}${block.body && !/\s$/.test(block.body) ? ' ' : ''}${placeholder}` })}
                                className="h-[1.875rem] rounded-full bg-surface-2 px-3 font-mono text-xs text-ink transition-colors hover:bg-accent-soft hover:text-accent"
                            >
                                {placeholder}
                            </button>
                        ))}
                    </div>
                </div>
            </form>
        </Drawer>
    );
}
