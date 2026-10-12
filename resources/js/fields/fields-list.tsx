import { ArrowDown, ArrowUp, ListPlus, Pencil, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { deleteFieldDefinition, reorderFieldDefinitions, saveFieldDefinition, type FieldDefinitionInput } from '@/api/fields';
import { DOCUMENT_TYPES, type DocumentType, type FieldDefinition, type FieldScope, type FieldType } from '@/api/types';
import { Button, Card, EmptyState, Tag, cx } from '@/components/ui';
import { errorMessage } from '@/lib/api';
import { t, tn } from '@/lib/i18n';
import { scheduleDelete, usePendingDeletes } from '@/lib/pending-delete';
import { toast } from '@/lib/toast';
import { emptyDefinition, hasDocTypes, moveId, toggleDocType } from './field-form';

const EXAMPLES: Record<FieldScope, { key: string; type: FieldType }[]> = {
    org: [{ key: 'register', type: 'text' }, { key: 'management', type: 'text' }],
    customer: [{ key: 'supplier_number', type: 'text' }, { key: 'industry', type: 'select' }],
    contact: [{ key: 'department', type: 'text' }, { key: 'birthday', type: 'date' }],
    document: [{ key: 'project_name', type: 'text' }, { key: 'order_number', type: 'text' }],
    position: [{ key: 'ticket', type: 'text' }, { key: 'service_month', type: 'date' }],
};
const COLUMNS = 'grid-cols-[minmax(0,1fr)_auto] md:grid-cols-[minmax(0,1fr)_8rem_9rem]';
const COLUMNS_TYPES = 'grid-cols-[minmax(0,1fr)_auto] md:grid-cols-[minmax(0,1fr)_8rem_11rem_9rem]';
const toInput = (field: FieldDefinition): FieldDefinitionInput => ({ ...field });

export function FieldsList({ scope, fields, onEdit }: { scope: FieldScope; fields: FieldDefinition[]; onEdit(input: FieldDefinitionInput, id?: string): void }) {
    const pending = usePendingDeletes();
    const [busy, setBusy] = useState(false);
    const visible = fields.filter((field) => !pending.has(field.id));
    const withTypes = hasDocTypes(scope);
    const columns = withTypes ? COLUMNS_TYPES : COLUMNS;

    const run = async (task: () => Promise<unknown>) => {
        setBusy(true);
        try {
            await task();
        } catch (error) {
            toast.error(errorMessage(error));
        } finally {
            setBusy(false);
        }
    };

    const toggle = (field: FieldDefinition, type: DocumentType) => {
        const next = toggleDocType(field.doc_types, type);
        if (!next) {
            toast.error(t('fields.last_type'));
            return;
        }
        const added = next.includes(type);
        void run(async () => {
            await saveFieldDefinition({ ...toInput(field), doc_types: next }, field.id);
            toast.success(t(added ? 'fields.type_added' : 'fields.type_removed', { label: field.label, type: t(`document_type.${type}`) }));
        });
    };

    const remove = (field: FieldDefinition) => {
        const handle = scheduleDelete(field.id, (options) => deleteFieldDefinition(field.id, options));
        toast.success(t('fields.deleted', { label: field.label }), {
            label: t('fields.undo'),
            run: () => {
                if (handle.undo()) toast.info(t('fields.restored', { label: field.label }));
            },
            onExpire: () => void handle.commit().catch((error: unknown) => toast.error(errorMessage(error))),
        });
    };

    if (visible.length === 0) {
        return (
            <Card flush>
                <EmptyState
                    icon={<ListPlus />}
                    title={t(`fields.empty.${scope}`)}
                    actions={EXAMPLES[scope].map((example) => (
                        <Button key={example.key} variant="soft" size="sm" icon={<Plus />} onClick={() => onEdit({ ...emptyDefinition(scope), label: t(`fields.example.${example.key}`), type: example.type })}>
                            {t(`fields.example.${example.key}`)}
                        </Button>
                    ))}
                >
                    {t('fields.empty_text')}
                </EmptyState>
            </Card>
        );
    }

    return (
        <Card flush aria-label={t('fields.list_label', { level: t(`fields.scope.${scope}`) })}>
            <div aria-hidden className={cx('hidden gap-4 px-6 pt-4 pb-1 text-xs font-medium text-muted md:grid', columns)}>
                <span>{t('fields.col_field')}</span>
                <span>{t('fields.col_type')}</span>
                {withTypes && <span>{t('fields.col_applies')}</span>}
                <span />
            </div>
            <ul className="m-0 grid list-none gap-0.5 p-2">
                {visible.map((field, index) => (
                    <li key={field.id} className={cx('grid items-center gap-x-4 gap-y-2 rounded-md px-4 py-2.5 hover:bg-surface-2', columns)}>
                        <button type="button" className="grid min-w-0 gap-0.5 text-left" onClick={() => onEdit(toInput(field), field.id)}>
                            <span className="flex items-center gap-2 font-strong">
                                {field.label}
                                {field.required && <Tag neutral>{t('fields.required')}</Tag>}
                            </span>
                            <span className="truncate text-sm text-muted">
                                <code className="rounded-sm bg-surface-2 px-1 font-mono text-xs">{field.key}</code>
                                {field.help && ` · ${field.help}`}
                            </span>
                        </button>
                        <span className="hidden text-sm text-muted md:grid">
                            {t(`fields.type.${field.type}`)}
                            {field.type === 'select' && <span className="text-xs">{tn('fields.option_count', field.options.length)}</span>}
                        </span>
                        {withTypes && (
                            <span role="group" aria-label={t('fields.applies_named', { label: field.label })} className="col-start-1 row-start-2 inline-flex gap-1 md:col-start-auto md:row-start-auto">
                                {DOCUMENT_TYPES.map((type) => (
                                    <button
                                        key={type}
                                        type="button"
                                        aria-pressed={field.doc_types.includes(type)}
                                        title={t(`document_type.${type}`)}
                                        disabled={busy}
                                        onClick={() => toggle(field, type)}
                                        className="h-7 min-w-9 rounded-full bg-surface-2 px-2 text-xs font-heading text-faint transition-colors hover:bg-surface-3 hover:text-ink disabled:cursor-progress aria-pressed:bg-accent-soft aria-pressed:text-accent"
                                    >
                                        {t(`fields.doc_short.${type}`)}
                                    </button>
                                ))}
                            </span>
                        )}
                        <span className="row-span-2 flex justify-end gap-0.5 md:row-span-1">
                            <Button variant="ghost" size="sm" iconOnly icon={<ArrowUp />} disabled={index === 0 || busy || fields.length !== visible.length} onClick={() => void run(() => reorderFieldDefinitions(scope, moveId(visible.map((f) => f.id), index, -1)))}>
                                {t('fields.move_up')}
                            </Button>
                            <Button variant="ghost" size="sm" iconOnly icon={<ArrowDown />} disabled={index === visible.length - 1 || busy || fields.length !== visible.length} onClick={() => void run(() => reorderFieldDefinitions(scope, moveId(visible.map((f) => f.id), index, 1)))}>
                                {t('fields.move_down')}
                            </Button>
                            <Button variant="ghost" size="sm" iconOnly icon={<Pencil />} onClick={() => onEdit(toInput(field), field.id)}>
                                {t('fields.edit')}
                            </Button>
                            <Button variant="ghost" size="sm" iconOnly icon={<Trash2 />} onClick={() => remove(field)}>
                                {t('fields.delete')}
                            </Button>
                        </span>
                    </li>
                ))}
            </ul>
        </Card>
    );
}
