import { TextQuote } from 'lucide-react';
import { useTextBlocks } from '@/api/master-data';
import type { TextBlockKind } from '@/api/types';
import { Button, Menu, MenuItem, Textarea } from '@/components/ui';
import { t } from '@/lib/i18n';
import { appendText } from '../ops';

const ORDER: Record<'intro' | 'closing', TextBlockKind[]> = {
    intro: ['intro', 'note', 'payment', 'closing'],
    closing: ['closing', 'payment', 'note', 'intro'],
};

/** Introduction or closing text, typed or from text blocks (appended after a blank line). */
export function TextsSection({ which, value, readOnly, error, onChange }: { which: 'intro' | 'closing'; value: string; readOnly: boolean; error?: string; onChange(value: string): void }) {
    const blocks = useTextBlocks().data ?? [];
    const sorted = [...blocks].sort((a, b) => ORDER[which].indexOf(a.kind) - ORDER[which].indexOf(b.kind));

    return (
        <Textarea
            label={which === 'intro' ? t('editor.intro') : t('editor.closing')}
            aside={
                !readOnly && (
                    <Menu
                        trigger={
                            <Button variant="ghost" size="sm" icon={<TextQuote />} disabled={sorted.length === 0}>
                                {t('editor.insert_block')}
                            </Button>
                        }
                    >
                        {sorted.map((block) => (
                            <MenuItem key={block.id} onSelect={() => onChange(appendText(value, block.body))}>
                                <span className="grid min-w-0">
                                    <span>{block.name}</span>
                                    <span className="max-w-72 truncate text-xs text-muted">{block.body.split('\n')[0]}</span>
                                </span>
                            </MenuItem>
                        ))}
                    </Menu>
                )
            }
            value={value}
            disabled={readOnly}
            rows={3}
            className="min-h-18"
            path={`document.${which}`}
            error={error}
            placeholder={which === 'intro' ? t('editor.intro_placeholder') : t('editor.closing_placeholder')}
            hint={readOnly ? undefined : t('editor.placeholder_hint')}
            onChange={(e) => onChange(e.target.value)}
        />
    );
}
