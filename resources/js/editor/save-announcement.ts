import type { SaveState } from './types';

/**
 * What the screen reader hears about saving: a problem once, and that it is solved once saving works again – not
 * "unsaved / saving / saved" every few hundred milliseconds while typing, and not the same error after every retry.
 * The real sequences run through saving/dirty (error → saving → saved, invalid → dirty → saving → saved), so the
 * announcer remembers that a problem is open since the last successful save instead of looking at the previous state.
 * Finalized or deleted elsewhere is an alert of the read-only notice. Feed every state; it returns a translation key
 * or null (stay quiet).
 */
export function createSaveAnnouncer(): (state: SaveState) => string | null {
    let problem: 'error' | 'invalid' | null = null;
    return (state) => {
        if (state === 'error' || state === 'invalid') {
            if (problem === state) return null;
            problem = state;
            return `editor.save.${state}`;
        }
        if (state === 'saved' && problem) {
            problem = null;
            return 'editor.save.saved';
        }
        if (state === 'locked' || state === 'gone') problem = null;
        return null;
    };
}
