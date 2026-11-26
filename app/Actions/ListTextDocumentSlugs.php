<?php

namespace App\Actions;

use App\Models\Document;
use App\Support\Actor;
use App\Support\LegalLinks;
use App\Support\TextDocuments;

/** What an attachment can point at: the newest finalized version of every short name, texts without customer only. */
final class ListTextDocumentSlugs
{
    /**
     * @return list<array{slug: string, title: string, number: string, is_public: bool, public_url: string|null}>
     */
    public function handle(Actor $actor): array
    {
        return TextDocuments::latestPerSlug()->map(fn (Document $document): array => [
            'slug' => (string) $document->slug,
            'title' => (string) $document->title,
            'number' => (string) $document->number,
            'is_public' => (bool) $document->is_public,
            'public_url' => LegalLinks::versionOf($document),
        ])->all();
    }
}
