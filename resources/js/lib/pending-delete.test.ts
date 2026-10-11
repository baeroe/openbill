import { afterEach, describe, expect, it, vi } from 'vitest';
import { commitAllKeepalive, pendingDeleteIds, scheduleDelete } from './pending-delete';

afterEach(() => commitAllKeepalive());

describe('scheduleDelete', () => {
    it('hides the draft until undo, without deleting it', () => {
        const run = vi.fn(async () => undefined);
        const pending = scheduleDelete('d1', run);

        expect(pendingDeleteIds().has('d1')).toBe(true);
        expect(pending.undo()).toBe(true);
        expect(pendingDeleteIds().has('d1')).toBe(false);
        expect(run).not.toHaveBeenCalled();
    });

    it('deletes on commit, once, and refuses undo once the delete started', async () => {
        let finish!: () => void;
        const run = vi.fn(() => new Promise<void>((resolve) => (finish = resolve)));
        const pending = scheduleDelete('d2', run);

        const committing = pending.commit();
        expect(pending.undo()).toBe(false);
        // stays hidden until the server answered (no flash of the row)
        expect(pendingDeleteIds().has('d2')).toBe(true);
        finish();
        await committing;
        await pending.commit();

        expect(run).toHaveBeenCalledTimes(1);
        expect(run).toHaveBeenCalledWith({ keepalive: false });
        expect(pendingDeleteIds().has('d2')).toBe(false);
    });

    it('shows the draft again when the delete fails', async () => {
        const pending = scheduleDelete('d3', async () => {
            throw new Error('locked');
        });

        await expect(pending.commit()).rejects.toThrow('locked');
        expect(pendingDeleteIds().has('d3')).toBe(false);
    });

    it('sends every waiting delete with keepalive when the tab closes (review focus)', () => {
        const run = vi.fn(async () => undefined);
        scheduleDelete('d4', run);

        commitAllKeepalive();

        expect(run).toHaveBeenCalledWith({ keepalive: true });
        expect(pendingDeleteIds().size).toBe(0);
    });
});
