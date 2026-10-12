<?php

namespace App\Actions;

use App\Exceptions\PdfRenderFailedException;
use App\Rendering\GotenbergClient;
use App\Rendering\PdfPageCount;
use App\Rendering\RenderResult;
use App\Support\Actor;
use App\Support\DomainMapper;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Validation\ValidationException;

/**
 * MCP render-template-preview: what an agent needs to judge a template, without the HTML. Same input as
 * POST /api/render (RenderPreview); adds the page count of the real PDF (one Gotenberg call, only when the
 * template rendered without errors), the expectedFields of the manifest that are missing as custom fields and
 * a short plain-text excerpt of the content. The PDF render has its own tight limit per token or user
 * (openbill.mcp.preview_pdfs_per_minute): an agent iterating on a template must not keep the single Gotenberg
 * busy, which finalizing needs. Over the limit the page count stays null, like when Gotenberg is down;
 * page_count_skipped says why (template_errors, pdf_unavailable, rate_limited).
 */
final class InspectTemplatePreview
{
    public const EXCERPT_CHARS = 1500;

    public function __construct(
        private readonly RenderPreview $preview,
        private readonly GotenbergClient $gotenberg,
    ) {}

    /**
     * @param  array<string, mixed>  $input  template_id?, template?, document_id | scenario, locale?
     * @return array{errors: list<array<string, mixed>>, page_count: int|null, page_count_skipped: string|null, missing_fields: list<array{scope: string, key: string, type: string, label: string, problem: string}>, issues: list<array<string, mixed>>, totals: array<string, mixed>, paper: array<string, string>, text_excerpt: string}
     *
     * @throws ValidationException
     */
    public function handle(Actor $actor, array $input): array
    {
        $result = $this->preview->handle($actor, $input);
        $data = $result->toArray();
        [$pages, $skipped] = $result->render->ok() ? $this->pageCount($actor, $result->render) : [null, 'template_errors'];

        return [
            'errors' => $data['errors'],
            'page_count' => $pages,
            'page_count_skipped' => $skipped,
            'missing_fields' => self::missingFields($result->manifest),
            'issues' => $data['issues'],
            'totals' => $data['totals'],
            'paper' => $data['paper'],
            'text_excerpt' => self::excerpt($result->render->body),
        ];
    }

    /**
     * @return array{0: int|null, 1: string|null} page count and why it is missing
     */
    private function pageCount(Actor $actor, RenderResult $render): array
    {
        $key = 'mcp-preview-pdf:'.$actor->type->value.':'.($actor->id ?? 'system');
        if (RateLimiter::tooManyAttempts($key, (int) config('openbill.mcp.preview_pdfs_per_minute'))) {
            return [null, 'rate_limited'];
        }
        RateLimiter::hit($key, 60);

        try {
            $pages = PdfPageCount::of($this->gotenberg->pdf($render));
        } catch (PdfRenderFailedException) {
            // the preview itself is fine; only the page count stays unknown
            return [null, 'pdf_unavailable'];
        }

        return [$pages, $pages === null ? 'pdf_unavailable' : null];
    }

    /**
     * expectedFields of the manifest without a custom field of the same scope and key, or with another type.
     *
     * @param  array<string, mixed>  $manifest
     * @return list<array{scope: string, key: string, type: string, label: string, problem: string}>
     */
    private static function missingFields(array $manifest): array
    {
        $defined = [];
        foreach (DomainMapper::currentFieldDefinitions() as $field) {
            $defined["{$field->scope->value}.{$field->key}"] = $field->type->value;
        }

        $missing = [];
        foreach (is_array($manifest['expectedFields'] ?? null) ? $manifest['expectedFields'] : [] as $expected) {
            if (! is_array($expected) || ! is_string($expected['scope'] ?? null) || ! is_string($expected['key'] ?? null)) {
                continue;
            }
            $type = is_string($expected['type'] ?? null) ? $expected['type'] : '';
            $actual = $defined["{$expected['scope']}.{$expected['key']}"] ?? null;
            if ($actual === $type) {
                continue;
            }
            $missing[] = [
                'scope' => $expected['scope'],
                'key' => $expected['key'],
                'type' => $type,
                'label' => is_string($expected['label'] ?? null) ? $expected['label'] : $expected['key'],
                'problem' => $actual === null ? 'not_defined' : 'other_type',
            ];
        }

        return $missing;
    }

    /** Text of the rendered content without head, styles and tags, whitespace collapsed, cut to EXCERPT_CHARS. */
    private static function excerpt(string $html): string
    {
        $text = (string) preg_replace('#<(head|style|script)\b[^>]*>.*?</\1>#is', ' ', $html);
        $text = html_entity_decode(strip_tags($text), ENT_QUOTES | ENT_HTML5, 'UTF-8');
        $text = trim((string) preg_replace('/\s+/u', ' ', $text));

        return mb_strlen($text) > self::EXCERPT_CHARS ? mb_substr($text, 0, self::EXCERPT_CHARS).'…' : $text;
    }
}
