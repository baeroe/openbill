import { formatDecimalInput, sameDecimal } from './decimal';

/** What a quantity or price field shows: the typed text and whether it is invalid (local, never sent). */
export type CellState = { raw: string; invalid: boolean };

export type CellSync = {
    /** The value of the draft now and when the field last synced. */
    value: string;
    previous: string;
    disabled: boolean;
    focused: boolean;
    minFraction: number;
};

/**
 * A value arrives from outside (save answer, server state, read-only after a conflict). A disabled field always shows
 * the stored value; a focused field keeps what is being typed; invalid input survives a value that is only spelled
 * differently ("1" → "1.0000"), but a real change of the stored value replaces it.
 */
export function syncCell(state: CellState, sync: CellSync): CellState {
    const stored = { raw: formatDecimalInput(sync.value, undefined, sync.minFraction), invalid: false };
    if (sync.disabled) return stored;
    if (sync.focused) return state;
    if (state.invalid && sameDecimal(sync.value, sync.previous)) return state;
    return stored;
}
