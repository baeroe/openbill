import { router } from '@inertiajs/react';
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { mutate } from 'swr';
import { keys } from '@/api/keys';
import { duplicateTemplate, saveTemplateFiles, type TemplateDetail } from '@/api/templates';
import type { CodeEditorHandle } from '@/components/code-editor';
import { ApiError, errorMessage } from '@/lib/api';
import { useLeaveGuard } from '@/lib/hooks';
import { path, t } from '@/lib/i18n';
import { useStoredFlag } from '@/lib/prefs';
import { toast } from '@/lib/toast';
import type { LineError } from '../diagnostics';
import { editorReducer, initEditor, isDirty, savePayload, type Part } from '../editor-state';
import { CodePane } from './code-pane';
import { EditorHeader } from './editor-header';

const NO_ERRORS: Record<Part, LineError[]> = { header: [], body: [], footer: [], css: [], manifest: [] };

/** Template editor: header, (Task 6: field bar), code, (Task 6: preview). Keyed by template id in the page. */
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
    const errors = NO_ERRORS; // Task 6: from the render answer

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

    const layout = useMemo(() => (fieldsOpen ? 'lg:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)]' : 'lg:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)]'), [fieldsOpen]);

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
            </div>
        </div>
    );
}
