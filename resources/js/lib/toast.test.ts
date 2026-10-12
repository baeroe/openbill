import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { currentToasts, dismissToast, pauseToasts, resumeToasts, toast } from './toast';

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
    resumeToasts('pointer');
    resumeToasts('focus');
    currentToasts().forEach((item) => dismissToast(item.id));
    vi.useRealTimers();
});

describe('toast', () => {
    it('shows at most three toasts, the newest last', () => {
        ['one', 'two', 'three', 'four'].forEach((message) => toast.info(message));

        expect(currentToasts().map((item) => item.message)).toEqual(['two', 'three', 'four']);
    });

    it('closes by itself, later when it offers an action', () => {
        toast.success('Customer saved');
        toast.info('Draft deleted', { label: 'Undo', run: () => undefined });

        vi.advanceTimersByTime(3600);
        expect(currentToasts().map((item) => item.message)).toEqual(['Draft deleted']);
        vi.advanceTimersByTime(2500);
        expect(currentToasts()).toEqual([]);
    });

    it('can be dismissed', () => {
        const id = toast.error('Could not save');
        dismissToast(id);

        expect(currentToasts()).toEqual([]);
    });

    it('keeps errors longer than confirmations', () => {
        toast.error('Could not save');
        toast.success('Saved');

        vi.advanceTimersByTime(3600);
        expect(currentToasts().map((item) => item.message)).toEqual(['Could not save']);
        vi.advanceTimersByTime(2500);
        expect(currentToasts()).toEqual([]);
    });

    it('stays while paused (pointer or focus on the toasts) and goes on with the remaining time', () => {
        toast.success('Customer saved');
        vi.advanceTimersByTime(3000);
        pauseToasts();
        vi.advanceTimersByTime(60_000);
        expect(currentToasts()).toHaveLength(1);

        resumeToasts();
        vi.advanceTimersByTime(400);
        expect(currentToasts()).toHaveLength(1);
        vi.advanceTimersByTime(200);
        expect(currentToasts()).toEqual([]);
    });
});

describe('onExpire', () => {
    it('runs when a toast with an action closes by itself or through its close button', () => {
        const expired = vi.fn();
        toast.success('Draft deleted', { label: 'Undo', run: () => undefined, onExpire: expired });
        vi.advanceTimersByTime(6100);
        expect(expired).toHaveBeenCalledTimes(1);

        const closed = vi.fn();
        const id = toast.success('Draft deleted', { label: 'Undo', run: () => undefined, onExpire: closed });
        dismissToast(id);
        expect(closed).toHaveBeenCalledTimes(1);
    });

    it('does not run when the action was used', () => {
        const expired = vi.fn();
        const id = toast.success('Draft deleted', { label: 'Undo', run: () => undefined, onExpire: expired });

        dismissToast(id, true);
        vi.advanceTimersByTime(10_000);
        expect(expired).not.toHaveBeenCalled();
    });

    it('runs for a toast pushed out by newer ones', () => {
        const expired = vi.fn();
        toast.success('Draft deleted', { label: 'Undo', run: () => undefined, onExpire: expired });
        ['one', 'two', 'three'].forEach((message) => toast.info(message));

        expect(expired).toHaveBeenCalledTimes(1);
    });

    it('runs again after an undo used with the keyboard: its focused button is gone and no blur ever comes (ledger phase 5)', () => {
        const first = toast.success('Draft deleted', { label: 'Undo', run: () => undefined });
        toast.info('Customer saved');
        pauseToasts('focus'); // Tab onto the undo button
        vi.advanceTimersByTime(10_000);
        expect(currentToasts()).toHaveLength(2);

        dismissToast(first, true); // Enter on undo: the toast and its button disappear
        vi.advanceTimersByTime(3_500);
        expect(currentToasts()).toEqual([]);
    });

    it('stays paused while the pointer is still over the toasts', () => {
        const first = toast.success('Draft deleted', { label: 'Undo', run: () => undefined });
        toast.info('Customer saved');
        pauseToasts('pointer');
        pauseToasts('focus');

        dismissToast(first, true);
        vi.advanceTimersByTime(10_000);
        expect(currentToasts()).toHaveLength(1);
        resumeToasts('pointer');
        vi.advanceTimersByTime(3_500);
        expect(currentToasts()).toEqual([]);
    });
});
