import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { KitState, RenderEvent, Source } from '../shared/protocol';
import { needsState, newer } from './describe';
import { isLive, onRenderEvent } from './hot';
import { chooseSource, fetchState } from './kit-api';

const message = (error: unknown): string => (error instanceof Error ? error.message : String(error));

/** State of the dev server plus the newest render event (first state, HMR events, own source changes). */
export function useKit() {
    const [state, setState] = useState<KitState | null>(null);
    const [event, setEvent] = useState<RenderEvent | null>(null);
    const [loadError, setLoadError] = useState<string | null>(null);
    const connected = useMemo(() => isLive(), []);

    // after a failed start: once a render works again, load sources, schema and the cleared failure
    const refreshedFor = useRef(0);
    useEffect(() => {
        // at most once per event: a state that still lacks the lookups must not cause a loop of requests
        if (event === null || refreshedFor.current >= event.seq || !needsState(state, event)) return;
        refreshedFor.current = event.seq;
        fetchState()
            .then(setState)
            .catch(() => undefined);
    }, [event, state]);

    useEffect(() => {
        let alive = true;
        const accept = (next: RenderEvent) => {
            if (alive) setEvent((current) => newer(current, next));
        };
        const stop = onRenderEvent(accept);
        fetchState()
            .then((loaded) => {
                if (!alive) return;
                setState(loaded);
                if (loaded.event) accept(loaded.event);
            })
            .catch((error: unknown) => alive && setLoadError(message(error)));
        return () => {
            alive = false;
            stop();
        };
    }, []);

    const setSource = useCallback(async (source: Source) => {
        try {
            const next = await chooseSource(source);
            setEvent((current) => newer(current, next));
            setLoadError(null);
        } catch (error) {
            setLoadError(message(error));
        }
    }, []);

    return { state, event, connected, loadError, setSource };
}
