import { describe, expect, it, vi } from 'vitest';
import { focusSoon } from './focus';

const element = (field: boolean) => ({ focus: vi.fn(), matches: () => field }) as unknown as HTMLElement & { focus: ReturnType<typeof vi.fn> };

function env(active: Element | null) {
    const frames: (() => void)[] = [];
    const doc = { activeElement: active };
    return { doc, frames, env: { doc, frame: (callback: () => void) => frames.push(callback) } };
}

describe('focusSoon', () => {
    it('focuses in the next frame when the focus did not move', () => {
        const button = element(false);
        const title = element(true);
        const { frames, env: e } = env(button);

        focusSoon(() => title, {}, e);
        expect(title.focus).not.toHaveBeenCalled();
        frames[0]();
        expect(title.focus).toHaveBeenCalledOnce();
    });

    it('does not pull the cursor out of a field the user went into meanwhile (review: invalid number flake)', () => {
        const title = element(true);
        const quantity = element(true);
        const { doc, frames, env: e } = env(title);

        focusSoon(() => title, {}, e);
        doc.activeElement = quantity;
        frames[0]();
        expect(title.focus).not.toHaveBeenCalled();
    });

    it('still focuses when the focus fell back to the page (undo button of a toast that closed)', () => {
        const title = element(true);
        const { doc, frames, env: e } = env(element(false));

        focusSoon(() => title, {}, e);
        doc.activeElement = element(false);
        frames[0]();
        expect(title.focus).toHaveBeenCalledOnce();
    });
});
