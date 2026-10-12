import { expect, it } from 'vitest';
import { readFlag, writeFlag } from './stored-flag';

it('remembers a flag and falls back when storage is missing or throws', () => {
    const values = new Map<string, string>();
    const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => void values.set(key, value) };
    const broken = { getItem: () => { throw new Error('denied'); }, setItem: () => { throw new Error('denied'); } };

    expect(readFlag('openbill-kit:guides', false, storage)).toBe(false);
    writeFlag('openbill-kit:guides', true, storage);
    expect(readFlag('openbill-kit:guides', false, storage)).toBe(true);
    expect(readFlag('openbill-kit:guides', true, undefined)).toBe(true);
    expect(readFlag('openbill-kit:guides', false, broken)).toBe(false);
    expect(() => writeFlag('openbill-kit:guides', true, broken)).not.toThrow();
});
