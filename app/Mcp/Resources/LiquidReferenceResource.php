<?php

namespace App\Mcp\Resources;

use Laravel\Mcp\Response;
use Laravel\Mcp\Server\Attributes\Description;
use Laravel\Mcp\Server\Attributes\MimeType;
use Laravel\Mcp\Server\Attributes\Name;
use Laravel\Mcp\Server\Attributes\Title;
use Laravel\Mcp\Server\Attributes\Uri;
use Laravel\Mcp\Server\Resource;

#[Name('liquid-reference')]
#[Title('Liquid reference')]
#[Description('How openbill templates work: package files, manifest.json, page layout, the Liquid context (org, customer, contact, document, groups, positions), custom fields, filters (money, number, date, t, …), escaping, limits and errors, sample data and an example. The same text as the "Templates" page of the documentation.')]
#[Uri('openbill://docs/liquid-reference')]
#[MimeType('text/markdown')]
final class LiquidReferenceResource extends Resource
{
    public function handle(): Response
    {
        return Response::text(self::text());
    }

    /**
     * docs/en/templates.md without VitePress markup (::: blocks) and images, read at runtime so the docs and the
     * agents read the same source. Phase 10: the Docker image must keep this file (.dockerignore).
     */
    public static function text(): string
    {
        $lines = explode("\n", (string) file_get_contents(base_path('docs/en/templates.md')));

        return trim(implode("\n", array_filter($lines, fn (string $line): bool => preg_match('/^\s*(:::|!\[)/', $line) !== 1)));
    }
}
