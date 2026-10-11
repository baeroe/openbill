import { Ban, ChevronDown, Copy, Download, Lock, MoreHorizontal, Repeat2, Trash2 } from 'lucide-react';
import type { DocumentDetail, DocumentPageContext } from '@/api/types';
import { Button, ConfirmDialog, Menu, MenuItem, MenuSeparator } from '@/components/ui';
import { t } from '@/lib/i18n';
import type { DocumentActions } from '../use-actions';

/** More actions, status change, conversion and finalize – each only when the page context allows it. */
export function EditorActions({ document, context, actions }: { document: DocumentDetail; context: DocumentPageContext; actions: DocumentActions }) {
    const { allowed } = context;
    const typeLabel = t(`document_type.${document.type}`);
    const busy = actions.pending !== null;

    return (
        <>
            <Menu
                trigger={
                    <Button variant="ghost" iconOnly icon={<MoreHorizontal />}>
                        {t('editor.more')}
                    </Button>
                }
            >
                <MenuItem icon={<Download />} onSelect={() => void actions.openPdf()}>
                    {t('editor.pdf')}
                </MenuItem>
                {allowed.duplicate && (
                    <MenuItem icon={<Copy />} disabled={busy} onSelect={() => void actions.duplicate()}>
                        {t('editor.duplicate')}
                    </MenuItem>
                )}
                {allowed.cancel && (
                    <>
                        <MenuSeparator />
                        <MenuItem danger icon={<Ban />} disabled={busy} onSelect={actions.openCancel}>
                            {t('editor.cancel_invoice')}
                        </MenuItem>
                    </>
                )}
                {allowed.delete && (
                    <>
                        <MenuSeparator />
                        <MenuItem danger icon={<Trash2 />} disabled={busy} onSelect={actions.remove}>
                            {t('editor.delete')}
                        </MenuItem>
                    </>
                )}
            </Menu>

            {allowed.statuses.length > 0 && (
                <Menu
                    trigger={
                        <Button pending={actions.pending === 'status'}>
                            {t('editor.status_change')}
                            <ChevronDown aria-hidden />
                        </Button>
                    }
                >
                    {allowed.statuses.map((status) => (
                        <MenuItem key={status} onSelect={() => void actions.setStatus(status)}>
                            {t(`editor.status_action.${status}`)}
                        </MenuItem>
                    ))}
                </Menu>
            )}

            {allowed.conversions.length === 1 && (
                <Button variant="primary" icon={<Repeat2 />} pending={actions.pending === 'convert'} onClick={() => void actions.convert(allowed.conversions[0])}>
                    {t('editor.convert_to', { type: t(`document_type.${allowed.conversions[0]}`) })}
                </Button>
            )}
            {allowed.conversions.length > 1 && (
                <Menu
                    trigger={
                        <Button variant="primary" icon={<Repeat2 />} pending={actions.pending === 'convert'}>
                            {t('editor.convert')}
                            <ChevronDown aria-hidden />
                        </Button>
                    }
                >
                    {allowed.conversions.map((type) => (
                        <MenuItem key={type} onSelect={() => void actions.convert(type)}>
                            {t('editor.convert_menu_item', { type: t(`document_type.${type}`) })}
                        </MenuItem>
                    ))}
                </Menu>
            )}

            {allowed.finalize && !document.is_locked && (
                <Button variant="primary" icon={<Lock />} pending={actions.pending === 'finalize'} onClick={() => void actions.startFinalize()}>
                    {t('editor.finalize')}
                </Button>
            )}

            <ConfirmDialog
                open={actions.finalizeOpen}
                onClose={actions.closeFinalize}
                onConfirm={() => void actions.confirmFinalize()}
                pending={actions.pending === 'finalize'}
                icon={<Lock />}
                title={t('editor.finalize_title', { type: typeLabel })}
                description={`${t('editor.finalize_text', { number: context.next_number ?? '–' })}${document.type === 'invoice' ? ` ${t('editor.read_only_invoice')}` : ''}`}
                confirmLabel={t('editor.finalize')}
            />
            <ConfirmDialog
                open={actions.cancelOpen}
                onClose={actions.closeCancel}
                onConfirm={() => void actions.confirmCancel()}
                pending={actions.pending === 'cancel'}
                danger
                icon={<Ban />}
                title={t('editor.cancel_title', { number: document.number ?? '' })}
                description={t('editor.cancel_text')}
                confirmLabel={t('editor.cancel_confirm')}
            />
        </>
    );
}
