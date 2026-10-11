import { useEffect, useRef, useState } from 'react';
import { controlClass, cx } from '@/components/ui';
import { t } from '@/lib/i18n';
import { formatDecimalInput, parseDecimalInput, sameDecimal } from '../decimal';
import { syncCell, type CellState } from '../decimal-cell-state';

type Props = {
    value: string;
    onCommit(value: string): void;
    label: string;
    disabled?: boolean;
    error?: string;
    path?: string;
    /** Decimals the API accepts (quantities and prices: 4). */
    scale?: number;
    minFraction?: number;
    suffix?: string;
    className?: string;
};

/**
 * Quantity or price. Valid input goes to the draft while typing ("12,5" → "12.5"), so the preview follows; invalid input
 * stays local, is marked when the field is left and is never sent.
 */
export function DecimalCell({ value, onCommit, label, disabled = false, error, path, scale = 4, minFraction = 0, suffix, className }: Props) {
    const [cell, setCell] = useState<CellState>(() => ({ raw: formatDecimalInput(value, undefined, minFraction), invalid: false }));
    const { raw, invalid } = cell;
    const focused = useRef(false);
    const selectOnMouseUp = useRef(false);
    const previous = useRef(value);

    // a value from outside (save answer, server state, read-only): see syncCell for what wins
    useEffect(() => {
        setCell((state) => syncCell(state, { value, previous: previous.current, disabled, focused: focused.current, minFraction }));
        previous.current = value;
    }, [value, disabled, minFraction]);

    const message = invalid ? t('editor.invalid_number') : error;

    return (
        <span className={cx('relative flex items-center', className)} data-path={path}>
            <input
                inputMode="decimal"
                aria-label={label}
                aria-invalid={message ? true : undefined}
                title={message}
                disabled={disabled}
                value={raw}
                onFocus={(e) => {
                    focused.current = true;
                    // typing replaces the value (a new row shows "0.00"); the mouse-up of the click would drop the selection
                    e.currentTarget.select();
                    selectOnMouseUp.current = true;
                }}
                onMouseUp={(e) => {
                    if (!selectOnMouseUp.current) return;
                    selectOnMouseUp.current = false;
                    e.preventDefault();
                }}
                onChange={(e) => {
                    const parsed = parseDecimalInput(e.target.value, scale);
                    setCell({ raw: e.target.value, invalid: invalid && parsed === 'invalid' });
                    if (parsed !== 'invalid' && parsed !== value) onCommit(parsed);
                }}
                onBlur={() => {
                    focused.current = false;
                    selectOnMouseUp.current = false;
                    const parsed = parseDecimalInput(raw, scale);
                    if (parsed === 'invalid') {
                        setCell({ raw, invalid: true });
                        return;
                    }
                    // the stored value may have changed while typing (server state): what is shown is what gets saved
                    if (!sameDecimal(parsed, value)) onCommit(parsed);
                    setCell({ raw: formatDecimalInput(parsed, undefined, minFraction), invalid: false });
                }}
                onKeyDown={(e) => {
                    if (e.key === 'Enter') e.currentTarget.blur();
                }}
                className={controlClass(!!message, cx('num h-control text-right', suffix && 'pr-7'))}
            />
            {suffix && (
                <span aria-hidden className="pointer-events-none absolute right-2.5 text-sm text-muted">
                    {suffix}
                </span>
            )}
        </span>
    );
}
