import { ChevronLeft, Copy, Download, Lock, Save } from 'lucide-react';
import { Badge, Button, ButtonLink, buttonClass } from '@/components/ui';
import { path, t } from '@/lib/i18n';
import { packageUrl, type TemplateManifest } from '@/api/templates';
import { ToolkitSlot } from './toolkit-slot';

type Props = {
    templateId: string;
    manifest: TemplateManifest;
    builtIn: boolean;
    dirty: boolean;
    saving: boolean;
    duplicating: boolean;
    onSave(): Promise<boolean>;
    onDiscard(): void;
    onDuplicate(): void;
};

export function EditorHeader({ templateId, manifest, builtIn, dirty, saving, duplicating, onSave, onDiscard, onDuplicate }: Props) {
    return (
        <header className="flex flex-wrap items-center gap-3 px-4 pt-4 pb-3 sm:px-6 sm:pt-5 sm:pb-4">
            <ButtonLink href={path('/templates')} variant="ghost" iconOnly icon={<ChevronLeft />}>
                {t('templates.back')}
            </ButtonLink>
            <div className="grid min-w-0 gap-0.5">
                <h1 className="min-w-0 truncate text-2xl font-bold tracking-brand">{manifest.name || t('templates.unnamed')}</h1>
                <div className="flex flex-wrap items-center gap-2 text-sm text-muted">
                    <span className="num">{t('templates.version', { version: manifest.version })}</span>
                    {manifest.author && <span>{t('templates.by', { author: manifest.author })}</span>}
                    {builtIn && (
                        <Badge plain>
                            <Lock aria-hidden className="size-3" /> {t('templates.read_only')}
                        </Badge>
                    )}
                    {!builtIn && dirty && <Badge tone="warn">{t('templates.unsaved')}</Badge>}
                </div>
            </div>
            <span className="flex-1" />
            {dirty ? (
                <Button variant="ghost" icon={<Download />} disabled title={t('templates.export_unsaved')}>
                    {t('templates.export')}
                </Button>
            ) : (
                <a href={packageUrl(templateId)} download className={buttonClass({ variant: 'ghost' })}>
                    <Download aria-hidden />
                    {t('templates.export')}
                </a>
            )}
            <ToolkitSlot templateId={templateId} builtIn={builtIn} dirty={dirty} save={onSave} />
            {builtIn ? (
                <Button variant="primary" icon={<Copy />} pending={duplicating} onClick={onDuplicate}>
                    {t('templates.duplicate_to_edit')}
                </Button>
            ) : (
                <>
                    {dirty && (
                        <Button variant="ghost" onClick={onDiscard}>
                            {t('templates.discard')}
                        </Button>
                    )}
                    <Button variant="primary" icon={<Save />} pending={saving} disabled={!dirty} onClick={() => void onSave()} title={t('templates.save_hint')}>
                        {t('templates.save')}
                    </Button>
                </>
            )}
        </header>
    );
}
