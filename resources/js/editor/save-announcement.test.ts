import { describe, expect, it } from 'vitest';
import { saveAnnouncement } from './save-announcement';

describe('saveAnnouncement', () => {
    it('stays quiet while typing and saving normally', () => {
        expect(saveAnnouncement('saved', 'dirty')).toBeNull();
        expect(saveAnnouncement('dirty', 'saving')).toBeNull();
        expect(saveAnnouncement('saving', 'saved')).toBeNull();
    });

    it('announces problems and when they are solved', () => {
        expect(saveAnnouncement('saving', 'error')).toBe('editor.save.error');
        expect(saveAnnouncement('saving', 'invalid')).toBe('editor.save.invalid');
        expect(saveAnnouncement('error', 'saved')).toBe('editor.save.saved');
        expect(saveAnnouncement('error', 'error')).toBeNull();
    });
});
