import { PanelLeftOpen } from 'lucide-react';
import type { Ref } from 'react';
import type { Paper } from '@/api/types';
import { CodeEditor, type CodeEditorHandle } from '@/components/code-editor';
import { Button, Notice, Tabs } from '@/components/ui';
import { t } from '@/lib/i18n';
import type { LineError } from '../diagnostics';
import { PARTS, type EditorState, type Part } from '../editor-state';
import { PaperForm } from './paper-form';

type Props = {
    state: EditorState;
    readOnly: boolean;
    errors: Record<Part, LineError[]>;
    /** Messages of the server for manifest.* (422 on save). */
    manifestViolations: string[];
    fieldsOpen: boolean;
    editorRef: Ref<CodeEditorHandle>;
    onOpenFields(): void;
    onPart(part: Part): void;
    onEdit(part: Exclude<Part, 'manifest'>, value: string): void;
    onManifestText(text: string): void;
    onPaper(patch: Partial<Paper>): void;
};

const LANGUAGE: Record<Exclude<Part, 'manifest'>, 'liquid' | 'css'> = { header: 'liquid', body: 'liquid', footer: 'liquid', css: 'css' };

export function CodePane({ state, readOnly, errors, manifestViolations, fieldsOpen, editorRef, onOpenFields, onPart, onEdit, onManifestText, onPaper }: Props) {
    const part = state.part;

    return (
        <section aria-label={t('templates.source')} className="grid min-h-[34rem] min-w-0 grid-rows-[auto_minmax(0,1fr)] overflow-hidden rounded-lg bg-surface-2 lg:min-h-0">
            <div className="tpl-tabs flex flex-wrap items-center gap-2 p-3">
                {!fieldsOpen && (
                    <Button size="sm" variant="ghost" iconOnly icon={<PanelLeftOpen />} onClick={onOpenFields}>
                        {t('templates.fields_open')}
                    </Button>
                )}
                <Tabs<Part>
                    label={t('templates.part_label')}
                    value={part}
                    onChange={onPart}
                    items={PARTS.map((value) => ({
                        value,
                        label: errors[value].length > 0 ? `${t(`templates.part.${value}`)} · ${errors[value].length}` : t(`templates.part.${value}`),
                    }))}
                />
            </div>
            <div className="mx-3 mb-3 grid min-h-0 grid-rows-[auto_auto_minmax(0,1fr)] overflow-hidden rounded-md bg-surface">
                <p className="px-4 py-2 text-xs text-muted">{t(`templates.hint.${part}`)}</p>
                {part === 'manifest' ? (
                    <div>
                        <PaperForm paper={state.files.manifest.paper} readOnly={readOnly} onChange={onPaper} />
                        {state.manifestProblem && (
                            <Notice tone="bad" className="mx-4 mb-3">
                                <b>{t('templates.manifest_invalid')}</b> {t(`templates.manifest_problem.${state.manifestProblem.code}`)} {state.manifestProblem.detail}
                            </Notice>
                        )}
                        {manifestViolations.length > 0 && (
                            <Notice tone="bad" className="mx-4 mb-3">
                                <ul className="m-0 grid list-none gap-0.5 p-0">
                                    {manifestViolations.map((message) => (
                                        <li key={message}>{message}</li>
                                    ))}
                                </ul>
                            </Notice>
                        )}
                    </div>
                ) : (
                    <div />
                )}
                <div className="min-h-0">
                    {part === 'manifest' ? (
                        <CodeEditor key="manifest" ref={editorRef} language="json" value={state.manifestText} readOnly={readOnly} ariaLabel="manifest.json" errors={errors.manifest} onChange={onManifestText} />
                    ) : (
                        <CodeEditor
                            key={part}
                            ref={editorRef}
                            language={LANGUAGE[part]}
                            value={state.files[part]}
                            readOnly={readOnly}
                            ariaLabel={t(`templates.part.${part}`)}
                            errors={errors[part]}
                            onChange={(value) => onEdit(part, value)}
                        />
                    )}
                </div>
            </div>
        </section>
    );
}
