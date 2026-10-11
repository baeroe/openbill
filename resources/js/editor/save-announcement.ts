import type { SaveState } from './types';

/**
 * What the screen reader hears about saving: only the changes that matter (a problem, and that it is solved), not
 * "unsaved / saving / saved" every few hundred milliseconds while typing. Finalized or deleted elsewhere is an alert
 * of the read-only notice. Returns a translation key or null (stay quiet).
 */
export function saveAnnouncement(previous: SaveState, next: SaveState): string | null {
    if (next === previous) return null;
    if (next === 'error') return 'editor.save.error';
    if (next === 'invalid') return 'editor.save.invalid';
    if (next === 'saved' && (previous === 'error' || previous === 'invalid')) return 'editor.save.saved';
    return null;
}
