import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { currentToasts, dismissToast, pauseToasts, resumeToasts, toast } from './toast';

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
    resumeToasts();
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
