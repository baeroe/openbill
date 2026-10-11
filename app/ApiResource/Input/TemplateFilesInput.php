<?php

namespace App\ApiResource\Input;

/** Body of PUT /api/templates/{id}/files (documentation only; the processor reads the raw JSON). */
final class TemplateFilesInput
{
    public ?string $header = null;

    public ?string $body = null;

    public ?string $footer = null;

    public ?string $css = null;

    /** @var array<string, mixed>|null manifest.json as object */
    public ?array $manifest = null;

    /** @var array<string, string>|null complete list "assets/<file>" => base64 */
    public ?array $assets = null;
}
