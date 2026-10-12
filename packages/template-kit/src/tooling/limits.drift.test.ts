import { readFileSync } from 'node:fs';
import path from 'node:path';
import { expect, it } from 'vitest';
import { ASSET_EXTENSIONS, LIMITS } from './template-files';

// packages/template-kit/src/tooling → repository root
const root = path.resolve(import.meta.dirname, '../../../..');

it('uses the template and rendering limits of config/openbill.php', () => {
    const config = readFileSync(path.join(root, 'config/openbill.php'), 'utf8');
    const bytes = (key: string): number => {
        const match = new RegExp(`'${key}' => ([\\d *_]+),`).exec(config);
        if (!match) throw new Error(`config/openbill.php has no ${key}`);
        return match[1].split('*').reduce((product, factor) => product * Number(factor.trim().replaceAll('_', '')), 1);
    };

    expect(LIMITS).toEqual({
        assetBytes: bytes('max_asset_bytes'),
        totalBytes: bytes('max_unpacked_bytes'),
        entries: bytes('max_entries'),
        packageBytes: bytes('max_package_bytes'),
        sourceBytes: bytes('max_source_bytes'),
    });
});

it('allows exactly the asset types of TemplatePackage::ASSET_TYPES', () => {
    const php = readFileSync(path.join(root, 'app/Rendering/TemplatePackage.php'), 'utf8');
    const block = /ASSET_TYPES = \[([\s\S]*?)\];/.exec(php)?.[1] ?? '';

    expect([...block.matchAll(/'([a-z0-9]+)' =>/g)].map((match) => match[1]).sort()).toEqual([...ASSET_EXTENSIONS].sort());
});
