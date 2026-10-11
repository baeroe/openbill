import { History } from 'lucide-react';
import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { usePositionSuggestions } from '@/api/master-data';
import type { PositionSuggestion, Unit } from '@/api/types';
import { controlClass, cx } from '@/components/ui';
import { formatMoney } from '@/lib/format';
import { t, tn } from '@/lib/i18n';
import { useDebounced } from '@/lib/hooks';

type Props = {
    value: string;
    onChange(value: string): void;
    onPick(suggestion: PositionSuggestion): void;
    onEnter?(): void;
    withSuggestions: boolean;
    units: Unit[];
    disabled?: boolean;
    autoFocus?: boolean;
    error?: string;
    placeholder: string;
    path: string;
    muted?: boolean;
};

/** Title of a position with suggestions from earlier documents (replaces a catalogue). Enter without a pick adds a row. */
export function TitleAutocomplete({ value, onChange, onPick, onEnter, withSuggestions, units, disabled = false, autoFocus = false, error, placeholder, path, muted = false }: Props) {
    const [open, setOpen] = useState(false);
    const [active, setActive] = useState(-1);
    const listId = useId();
    const input = useRef<HTMLInputElement>(null);
    const query = useDebounced(open && withSuggestions && !disabled ? value : '', 150);
    const { data = [] } = usePositionSuggestions(query);
    const matches = data.filter((s) => s.title.toLowerCase() !== value.trim().toLowerCase()).slice(0, 6);
    const show = open && matches.length > 0;

    // focus after inserting a row; an effect, because autoFocus gets lost after clicks
    useEffect(() => {
        if (autoFocus) requestAnimationFrame(() => input.current?.focus());
    }, [autoFocus]);

    const pick = (suggestion: PositionSuggestion) => {
        onPick(suggestion);
        setOpen(false);
        setActive(-1);
    };

    const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'ArrowDown' && matches.length) {
            e.preventDefault();
            setOpen(true);
            setActive((a) => (a + 1) % matches.length);
        } else if (e.key === 'ArrowUp' && matches.length) {
            e.preventDefault();
            setActive((a) => (a <= 0 ? matches.length - 1 : a - 1));
        } else if (e.key === 'Escape') {
            setOpen(false);
            setActive(-1);
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (show && active >= 0) pick(matches[active]);
            else {
                setOpen(false);
                onEnter?.();
            }
        }
    };

    const unitSymbol = (id: string | null) => units.find((u) => u.id === id)?.symbol;

    return (
        <div className="relative" data-path={path}>
            <input
                ref={input}
                className={controlClass(!!error, cx('h-control', muted ? 'text-muted italic' : 'font-medium'))}
                value={value}
                placeholder={placeholder}
                disabled={disabled}
                title={error}
                role="combobox"
                aria-label={t('editor.col_title')}
                aria-invalid={error ? true : undefined}
                aria-expanded={show}
                aria-controls={listId}
                aria-autocomplete="list"
                aria-activedescendant={show && active >= 0 ? `${listId}-${active}` : undefined}
                onChange={(e) => {
                    onChange(e.target.value);
                    setOpen(true);
                    setActive(-1);
                }}
                onFocus={() => setOpen(true)}
                onBlur={() => setTimeout(() => setOpen(false), 120)}
                onKeyDown={onKeyDown}
            />
            {show && (
                <ul id={listId} role="listbox" aria-label={t('editor.suggestions')} className="absolute top-[calc(100%+4px)] left-0 z-30 m-0 grid w-[min(28rem,100%)] min-w-64 animate-pop-in list-none rounded-md bg-surface p-1.5 shadow-float">
                    <li aria-hidden className="flex items-center gap-1.5 px-2 pt-1 pb-1.5 text-xs text-muted [&_svg]:size-3">
                        <History />
                        {t('editor.suggestions')}
                    </li>
                    {matches.map((s, i) => (
                        <li
                            key={s.title}
                            id={`${listId}-${i}`}
                            role="option"
                            aria-selected={i === active}
                            className={cx('grid cursor-pointer gap-px rounded-sm px-2.5 py-[7px]', i === active && 'bg-accent-soft')}
                            onMouseDown={(e) => {
                                e.preventDefault();
                                pick(s);
                            }}
                            onMouseEnter={() => setActive(i)}
                        >
                            <span className={cx('font-medium', i === active && 'text-accent')}>{s.title}</span>
                            <span className="num text-xs text-muted">
                                {formatMoney(s.unit_price)}
                                {unitSymbol(s.unit_id) && ` / ${unitSymbol(s.unit_id)}`}
                                {` · ${tn('editor.used_count', s.used_count)}`}
                            </span>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}
