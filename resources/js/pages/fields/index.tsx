import { Head, router } from '@inertiajs/react';
import { Plus } from 'lucide-react';
import { useState } from 'react';
import { useAllFieldDefinitions, type FieldDefinitionInput } from '@/api/fields';
import type { FieldScope } from '@/api/types';
import { Button, Card, ErrorState, ListSkeleton, Page, PageHeader, Tabs } from '@/components/ui';
import { BuiltInFields } from '@/fields/built-in-fields';
import { FieldDrawer } from '@/fields/field-drawer';
import { emptyDefinition } from '@/fields/field-form';
import { FieldsList } from '@/fields/fields-list';
import { appLayout } from '@/layouts/app-shell';
import { path, t } from '@/lib/i18n';

const SCOPES: FieldScope[] = ['org', 'customer', 'contact', 'document', 'position'];

/** Custom fields (/{locale}/fields?scope=…): one tab per level. */
export default function Fields({ scope }: { scope: FieldScope }) {
    const all = useAllFieldDefinitions();
    const [editing, setEditing] = useState<{ input: FieldDefinitionInput; id?: string } | null>(null);
    const fields = (all.data ?? []).filter((field) => field.scope === scope);

    return (
        <Page>
            <Head title={t('nav.fields')} />
            <PageHeader
                title={t('nav.fields')}
                description={t('fields.description')}
                actions={
                    <Button variant="primary" icon={<Plus />} onClick={() => setEditing({ input: emptyDefinition(scope) })}>
                        {t('fields.add')}
                    </Button>
                }
            />
            <Tabs<FieldScope>
                label={t('fields.level_label')}
                value={scope}
                onChange={(next) => router.get(path('/fields'), { scope: next }, { preserveState: true, preserveScroll: true, replace: true })}
                items={SCOPES.map((item) => ({
                    value: item,
                    label: (
                        <>
                            {t(`fields.scope.${item}`)}
                            {all.data && <span className="num text-xs text-faint">{all.data.filter((field) => field.scope === item).length}</span>}
                        </>
                    ),
                }))}
            />
            <div className="grid max-w-[72ch] gap-1">
                <p>{t(`fields.intro.${scope}`)}</p>
                <p className="text-muted">
                    {t('fields.in_template')} <code className="rounded-sm bg-surface-2 px-1 font-mono text-xs">{scope === 'position' ? '{% for p in positions %} {{ p.key }}' : `{{ ${scope}.key }}`}</code>
                </p>
            </div>
            {all.error ? (
                <Card>
                    <ErrorState error={all.error} onRetry={() => void all.mutate()} />
                </Card>
            ) : !all.data ? (
                <Card flush>
                    <ListSkeleton rows={4} />
                </Card>
            ) : (
                <FieldsList key={scope} scope={scope} fields={fields} onEdit={(input, id) => setEditing({ input, id })} />
            )}
            <BuiltInFields key={`builtin-${scope}`} scope={scope} />
            {editing && <FieldDrawer key={editing.id ?? 'new'} initial={editing.input} id={editing.id} onClose={() => setEditing(null)} />}
        </Page>
    );
}

Fields.layout = appLayout;
