import { describe, expect, it } from 'vitest';
import type { RenderEvent } from '../shared/protocol';
import { isLive, onRenderEvent } from './hot';

describe('onRenderEvent', () => {
    it('forwards the bridge events until unsubscribed', () => {
        const target = new EventTarget();
        const seen: number[] = [];
        const stop = onRenderEvent((event: RenderEvent) => seen.push(event.seq), target);

        target.dispatchEvent(new CustomEvent('openbill:render', { detail: { seq: 4 } }));
        stop();
        target.dispatchEvent(new CustomEvent('openbill:render', { detail: { seq: 5 } }));

        expect(seen).toEqual([4]);
    });

    it('knows whether the bridge of pnpm dev ran', () => {
        expect(isLive(Object.assign(new EventTarget(), { __openbillLive: true }))).toBe(true);
        expect(isLive(new EventTarget())).toBe(false);
    });
});
