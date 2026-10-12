import { router } from '@inertiajs/react';
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { mutate } from 'swr';
import { keys } from '@/api/keys';
import { duplicateTemplate, saveTemplateFiles, useRenderSchema, useRenderSources, type TemplateDetail } from '@/api/templates';
import type { RenderErrorItem } from '@/api/types';
import type { CodeEditorHandle } from '@/components/code-editor';
import { ApiError, errorMessage } from '@/lib/api';
import { useLeaveGuard } from '@/lib/hooks';
import { path, t } from '@/lib/i18n';
import { useStoredFlag } from '@/lib/prefs';
import { toast } from '@/lib/toast';
import { editorReducer, initEditor, isDirty, savePayload, zoneOf } from '../editor-state';
import { errorsByPart, missingExpectedFields } from '../errors';
import { defaultSource, type SampleSource } from '../scenario';
import { CodePane } from './code-pane';
import { EditorHeader } from './editor-header';
import { FieldSidebar } from './field-sidebar';
import { PreviewPane } from './preview-pane';
import { useTemplatePreview } from './use-template-preview';

/** Template editor: header, field bar, code, preview. Keyed by template id in the page. */
export function TemplateEditor({ template }: { template: TemplateDetail }) {
    const [state, dispatch] = useReducer(editorReducer, template, initEditor);
    const [saving, setSaving] = useState(false);
    const [duplicating, setDuplicating] = useState(false);
    const [manifestViolations, setManifestViolations] = useState<string[]>([]);
    const [fieldsOpen, setFieldsOpen] = useStoredFlag('openbill:template-fields', true);
    const editorRef = useRef<CodeEditorHandle>(null);
    const readOnly = template.built_in;
    const dirty = !readOnly && isDirty(state);
    const releaseGuard = useLeaveGuard(dirty, t('templates.leave_confirm'));
    const sources = useRenderSources();
    const schema = useRenderSchema();
    const [picked, setPicked] = useState<SampleSource | null>(null);
    const source = picked ?? (sources.data ? defaultSource(sources.data) : null);
    const preview = useTemplatePreview(template.id, state.files, source);
    const errors = useMemo(() => errorsByPart(preview.data?.errors ?? []), [preview.data?.errors]);
    const missing = useMemo(() => (schema.data ? missingExpectedFields(state.files.manifest, schema.data) : []), [schema.data, state.files.manifest]);
    const liquidPart = state.part === 'header' || state.part === 'body' || state.part === 'footer';
    const insertDisabled = readOnly ? t('templates.insert_read_only') : !liquidPart ? t('templates.insert_liquid_only') : null;

    const jump = (item: RenderErrorItem) => {
        if (item.part !== 'header' && item.part !== 'body' && item.part !== 'footer' && item.part !== 'css' && item.part !== 'manifest') return;
        dispatch({ type: 'part', part: item.part });
        // the tab's editor mounts in the next frame
        requestAnimationFrame(() => item.line && editorRef.current?.goToLine(item.line));
    };

    const save = useCallback(async (): Promise<boolean> => {
        const payload = savePayload(state);
        if (!payload) {
            dispatch({ type: 'part', part: 'manifest' });
            toast.error(t('templates.manifest_fix_first'));
            return false;
        }
        setSaving(true);
        try {
            const saved = await saveTemplateFiles(template.id, payload);
            dispatch({ type: 'saved', template: saved });
            setManifestViolations([]);
            void mutate(keys.template(template.id), saved, { revalidate: false });
            toast.success(t('templates.saved'));
            return true;
        } catch (error) {
            const manifest = error instanceof ApiError ? error.violations.filter((v) => v.path === 'manifest' || v.path.startsWith('manifest.')) : [];
            if (manifest.length > 0) {
                setManifestViolations(manifest.map((v) => `${v.path.replace(/^manifest\.?/, '') || 'manifest'}: ${v.message}`));
                dispatch({ type: 'part', part: 'manifest' });
            }
            toast.error(errorMessage(error));
            return false;
        } finally {
            setSaving(false);
        }
    }, [state, template.id]);

    const duplicate = async () => {
        setDuplicating(true);
        try {
            const copy = await duplicateTemplate(template.id);
            toast.success(t('templates.duplicated', { name: copy.name }));
            releaseGuard();
            router.visit(path(`/templates/${copy.id}`));
        } catch (error) {
            toast.error(errorMessage(error));
        } finally {
            setDuplicating(false);
        }
    };

    // ⌘S / Ctrl+S saves (also inside CodeMirror: the event bubbles up)
    useEffect(() => {
        const onKey = (event: KeyboardEvent) => {
            if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') {
                event.preventDefault();
                if (!readOnly && dirty && !saving) void save();
            }
        };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [readOnly, dirty, saving, save]);

    const layout = fieldsOpen
        ? 'lg:grid-cols-[12rem_minmax(0,1fr)_minmax(0,0.8fr)] xl:grid-cols-[15rem_minmax(0,1fr)_minmax(0,0.9fr)]'
        : 'lg:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)]';

    return (
        <div className="grid grid-rows-[auto_minmax(0,1fr)] lg:h-[calc(100dvh-1.5rem)]">
            <EditorHeader
                templateId={template.id}
                manifest={state.files.manifest}
                builtIn={readOnly}
                dirty={dirty}
                saving={saving}
                duplicating={duplicating}
                onSave={save}
                onDiscard={() => {
                    dispatch({ type: 'discard' });
                    setManifestViolations([]);
                }}
                onDuplicate={() => void duplicate()}
            />
            <div className={`grid min-h-0 gap-3 px-3 pb-3 ${layout}`}>
                {fieldsOpen && <FieldSidebar schema={schema.data} disabledReason={insertDisabled} onInsert={(code) => editorRef.current?.insert(code)} onClose={() => setFieldsOpen(false)} />}
                <CodePane
                    state={state}
                    readOnly={readOnly}
                    errors={errors}
                    manifestViolations={manifestViolations}
                    fieldsOpen={fieldsOpen}
                    editorRef={editorRef}
                    onOpenFields={() => setFieldsOpen(true)}
                    onPart={(part) => dispatch({ type: 'part', part })}
                    onEdit={(part, value) => dispatch({ type: 'edit', part, value })}
                    onManifestText={(text) => dispatch({ type: 'manifest_text', text })}
                    onPaper={(patch) => dispatch({ type: 'paper', patch })}
                />
                <PreviewPane
                    data={preview.data}
                    error={preview.error}
                    highlight={zoneOf(state.part)}
                    sources={sources.data}
                    source={source}
                    missing={missing}
                    onSource={setPicked}
                    onJump={jump}
                />
            </div>
        </div>
    );
}
