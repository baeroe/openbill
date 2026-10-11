import { useEffect, useRef, useState } from 'react';
import { controlClass, cx } from '@/components/ui';
import { t } from '@/lib/i18n';
import { formatDecimalInput, parseDecimalInput } from '../decimal';

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
    const [raw, setRaw] = useState(() => formatDecimalInput(value, undefined, minFraction));
    const [invalid, setInvalidState] = useState(false);
    // invalid input is the user's unsent edit: a value arriving from outside (save answer, reload) must not wipe it
    const invalidRef = useRef(false);
    const setInvalid = (next: boolean) => {
        invalidRef.current = next;
        setInvalidState(next);
    };
    const focused = useRef(false);
    const selectOnMouseUp = useRef(false);

    useEffect(() => {
        if (focused.current || invalidRef.current) return;
        setRaw(formatDecimalInput(value, undefined, minFraction));
    }, [value, minFraction]);

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
                    setRaw(e.target.value);
                    const parsed = parseDecimalInput(e.target.value, scale);
                    if (parsed === 'invalid') return;
                    setInvalid(false);
                    if (parsed !== value) onCommit(parsed);
                }}
                onBlur={() => {
                    focused.current = false;
                    selectOnMouseUp.current = false;
                    const parsed = parseDecimalInput(raw, scale);
                    if (parsed === 'invalid') {
                        setInvalid(true);
                        return;
                    }
                    setRaw(formatDecimalInput(parsed, undefined, minFraction));
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
