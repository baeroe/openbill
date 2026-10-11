<?php

namespace App\Rendering;

use App\Models\Template;
use Illuminate\Support\Facades\Storage;

/** The parts of a template as the renderer needs them (from a model, a snapshot or unsaved editor/toolkit input). */
final readonly class TemplateSource
{
    /**
     * @param  array<string, mixed>  $manifest
     * @param  array<string, array{mime: string, contents: string}>  $assets  by package path ("assets/logo.svg")
     */
    public function __construct(
        public string $header,
        public string $body,
        public string $footer,
        public string $css,
        public array $manifest = [],
        public array $assets = [],
    ) {}

    public static function fromModel(Template $template): self
    {
        $assets = [];
        foreach ($template->assets as $asset) {
            $contents = Storage::disk('local')->get($asset->storage_path);
            if ($contents !== null) {
                $assets[$asset->path] = ['mime' => $asset->mime, 'contents' => $contents];
            }
        }

        return new self(
            (string) $template->header,
            (string) $template->body,
            (string) $template->footer,
            (string) $template->css,
            $template->manifest ?? [],
            $assets,
        );
    }

    /**
     * "template" of a snapshot (SnapshotBuilder). Finalized documents are never re-rendered for downloads
     * (they come from the archive), so reading the assets live by template id is fine for previews.
     *
     * @param  array<string, mixed>  $row
     */
    public static function fromSnapshot(array $row): self
    {
        $template = is_string($row['id'] ?? null) ? Template::query()->with('assets')->find($row['id']) : null;

        return new self(
            (string) ($row['header'] ?? ''),
            (string) ($row['body'] ?? ''),
            (string) ($row['footer'] ?? ''),
            (string) ($row['css'] ?? ''),
            is_array($row['manifest'] ?? null) ? $row['manifest'] : [],
            $template === null ? [] : self::fromModel($template)->assets,
        );
    }

    /**
     * Unsaved parts (editor, toolkit) on top of this template; the assets stay.
     *
     * @param  array<string, mixed>  $parts  header, body, footer, css, manifest
     */
    public function with(array $parts): self
    {
        $text = fn (string $key, string $current): string => array_key_exists($key, $parts) ? (string) $parts[$key] : $current;

        return new self(
            $text('header', $this->header),
            $text('body', $this->body),
            $text('footer', $this->footer),
            $text('css', $this->css),
            is_array($parts['manifest'] ?? null) ? $parts['manifest'] : $this->manifest,
            $this->assets,
        );
    }
}
