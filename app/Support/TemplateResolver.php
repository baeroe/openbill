<?php

namespace App\Support;

use App\Models\Document;
use App\Models\DocumentTypeSetting;
use App\Models\Template;

/** Which template renders a document: its own, else its type's default, else the built-in "klar". */
final class TemplateResolver
{
    public static function for(Document $document): ?Template
    {
        $id = $document->template_id
            ?? DocumentTypeSetting::query()->whereKey($document->type->value)->value('template_id');
        $template = is_string($id) ? Template::query()->find($id) : null;

        return $template ?? self::fallback();
    }

    public static function fallback(): ?Template
    {
        return Template::query()->where('slug', 'klar')->first()
            ?? Template::query()->orderByDesc('built_in')->orderBy('name')->first();
    }
}
