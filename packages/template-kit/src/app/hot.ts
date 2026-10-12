import { RENDER_EVENT, type RenderEvent } from '../shared/protocol';

type LiveTarget = EventTarget & { __openbillLive?: boolean };

/**
 * Render events of the dev server. The page is a prebuilt bundle without import.meta.hot: the plugin's bridge module
 * (/@openbill/bridge.js, injected by `pnpm dev`) turns the HMR event into a window event of the same name.
 */
export function onRenderEvent(listener: (event: RenderEvent) => void, target: LiveTarget = window): () => void {
    const handler = (event: Event) => listener((event as CustomEvent<RenderEvent>).detail);
    target.addEventListener(RENDER_EVENT, handler);
    return () => target.removeEventListener(RENDER_EVENT, handler);
}

/** True when the page came from `pnpm dev` (the bridge runs before the page). */
export function isLive(target: LiveTarget = window): boolean {
    return target.__openbillLive === true;
}
