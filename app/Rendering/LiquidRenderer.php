<?php

namespace App\Rendering;

use App\Enums\RenderPart;
use App\Rendering\Liquid\LiquidEnvironment;
use App\Rendering\Liquid\RenderEnv;
use App\Support\Text;
use Brick\Math\BigDecimal;
use Keepsuit\Liquid\Environment;
use Keepsuit\Liquid\Exceptions\LiquidException;
use Keepsuit\Liquid\Exceptions\ResourceLimitException;
use Throwable;

/**
 * Renders a template into three standalone HTML documents – body, header, footer – exactly as Gotenberg
 * receives them (port of prototypes/clickdummy-v2/src/domain/liquid.ts). Never throws because of the
 * template: problems end up in RenderResult::$errors and the part shows an error box.
 *
 * Escaping: keepsuit has no auto-escape, so every string of the context is HTML-escaped exactly once
 * before rendering. Intro and closing (Liquid too, from text blocks) are rendered on the raw data first
 * and escaped together with the rest.
 */
final class LiquidRenderer
{
    private const PAGE_TOKENS = [
        '/\{\{\s*page\.number\s*\}\}/' => '<span class="pageNumber"></span>',
        '/\{\{\s*page\.total\s*\}\}/' => '<span class="totalPages"></span>',
    ];

    private Environment $liquid;

    public function __construct(private readonly AssetInliner $assets)
    {
        $this->liquid = LiquidEnvironment::make();
    }

    /**
     * @param  array<string, mixed>  $context  raw values (ContextBuilder::build()->data)
     */
    public function render(TemplateSource $template, array $context, RenderOptions $options = new RenderOptions): RenderResult
    {
        /** @var list<RenderError> $errors */
        $errors = [];
        foreach (Paper::errors($template->manifest['paper'] ?? null) as $message) {
            $errors[] = new RenderError(RenderPart::Manifest, null, $message);
        }
        $paper = Paper::fromManifest($template->manifest);
        $env = new RenderEnv($options->locale, self::translations($template->manifest));

        $document = is_array($context['document'] ?? null) ? $context['document'] : [];
        foreach ([[RenderPart::Intro, 'intro'], [RenderPart::Closing, 'closing']] as [$part, $key]) {
            if (is_string($document[$key] ?? null) && $document[$key] !== '') {
                $document[$key] = $this->part($part, $document[$key], $context, $env, $errors) ?? $document[$key];
            }
        }
        $context['document'] = $document;
        /** @var array<string, mixed> $escaped */
        $escaped = self::escape($context);

        $css = $this->css($template->css, $errors);
        $body = $this->part(RenderPart::Body, $template->body, $escaped, $env, $errors) ?? self::errorBox(end($errors));
        $header = $this->part(RenderPart::Header, self::pageTokens($template->header), $escaped, $env, $errors) ?? self::errorBox(end($errors));
        $footer = $this->part(RenderPart::Footer, self::pageTokens($template->footer), $escaped, $env, $errors) ?? self::errorBox(end($errors));

        $title = trim(((string) ($escaped['document']['type_label'] ?? '')).' '.((string) ($escaped['document']['number'] ?? '')));

        return new RenderResult(
            header: self::bandShell($this->assets->inline($header, $template->assets), $paper, $paper->headerHeightPx(), $options->locale),
            body: self::bodyShell($this->assets->inline($body, $template->assets), $this->assets->inline($css, $template->assets), $paper, $title, $options),
            footer: self::bandShell($this->assets->inline($footer, $template->assets), $paper, $paper->footerHeightPx(), $options->locale),
            paper: $paper,
            errors: $errors,
        );
    }

    /**
     * One Liquid part; null (and an entry in $errors) when it fails.
     *
     * @param  array<string, mixed>  $data
     * @param  list<RenderError>  $errors
     */
    private function part(RenderPart $part, string $source, array $data, RenderEnv $env, array &$errors): ?string
    {
        $max = (int) config('openbill.rendering.max_source_bytes');
        if (strlen($source) > $max) {
            $errors[] = new RenderError($part, null, Text::t('rendering.error.too_large', ['kb' => intdiv($max, 1024)]));

            return null;
        }
        if (trim($source) === '') {
            return '';
        }

        try {
            return $this->liquid->parseString($source)->render(
                $this->liquid->newRenderContext(data: $data, registers: [RenderEnv::REGISTER => $env]),
            );
        } catch (ResourceLimitException) {
            $errors[] = new RenderError($part, null, Text::t('rendering.error.limit'));
        } catch (LiquidException $e) {
            $errors[] = new RenderError($part, $e->lineNumber, $e->getMessage());
        } catch (Throwable $e) {
            report($e);
            $errors[] = new RenderError($part, null, Text::t('rendering.error.internal', ['message' => $e->getMessage()]));
        }

        return null;
    }

    /**
     * styles.css is plain CSS (no Liquid); it must not end the <style> element it is put into.
     *
     * @param  list<RenderError>  $errors
     */
    private function css(string $css, array &$errors): string
    {
        $max = (int) config('openbill.rendering.max_source_bytes');
        if (strlen($css) > $max) {
            $errors[] = new RenderError(RenderPart::Css, null, Text::t('rendering.error.too_large', ['kb' => intdiv($max, 1024)]));

            return '';
        }
        $position = stripos($css, '</style');
        if ($position !== false) {
            $errors[] = new RenderError(RenderPart::Css, substr_count($css, "\n", 0, $position) + 1, Text::t('rendering.error.style_tag'));

            return '';
        }

        return $css;
    }

    /** {{ page.number }} / {{ page.total }} become the elements Chromium fills while printing (same line count). */
    private static function pageTokens(string $source): string
    {
        return (string) preg_replace(array_keys(self::PAGE_TOKENS), array_values(self::PAGE_TOKENS), $source);
    }

    private static function escape(mixed $value): mixed
    {
        if (is_string($value)) {
            return htmlspecialchars($value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
        }
        if (is_array($value)) {
            return array_map(self::escape(...), $value);
        }

        return $value;
    }

    /**
     * @param  array<string, mixed>  $manifest
     * @return array<string, array<string, string>>
     */
    private static function translations(array $manifest): array
    {
        $translations = [];
        foreach (is_array($manifest['translations'] ?? null) ? $manifest['translations'] : [] as $locale => $words) {
            if (is_string($locale) && is_array($words)) {
                $translations[$locale] = array_filter($words, fn (mixed $word, mixed $key): bool => is_string($key) && is_string($word), ARRAY_FILTER_USE_BOTH);
            }
        }

        return $translations;
    }

    private static function errorBox(RenderError|false $error): string
    {
        if ($error === false) {
            return '';
        }
        $where = Text::t('rendering.error_box', ['part' => $error->part->value]).($error->line === null ? '' : ", {$error->line}");

        return '<div class="openbill-error" style="font:13px/1.5 system-ui,sans-serif;color:#b42318;border:1px solid #b42318;padding:8px 12px">'
            .'<strong>'.e($where).'</strong><pre style="white-space:pre-wrap;margin:4px 0 0">'.e($error->message).'</pre></div>';
    }

    private static function head(string $locale, string $title): string
    {
        return '<!doctype html><html lang="'.e($locale).'"><head><meta charset="utf-8"><title>'.$title.'</title>';
    }

    /** Body: as wide as the content area, no own margins (Gotenberg sets them from the paper). */
    private static function bodyShell(string $body, string $css, Paper $paper, string $title, RenderOptions $options): string
    {
        $mark = $options->draftMark === null ? '' : '<div class="openbill-draft-mark">'.e($options->draftMark).'</div>';
        $markCss = $options->draftMark === null ? '' : '.openbill-draft-mark{position:fixed;top:42%;left:0;right:0;text-align:center;'
            .'transform:rotate(-30deg);font:700 72pt/1 sans-serif;letter-spacing:.1em;color:rgba(0,0,0,.07);pointer-events:none;z-index:1000}'."\n";

        return self::head($options->locale, $title)
            ."<style>\nhtml{background:#fff;-webkit-print-color-adjust:exact;print-color-adjust:exact}\n"
            ."body{margin:0;width:{$paper->contentWidthPx()}px}\n@media print{body{width:auto}}\n"
            .$markCss.$css."\n</style></head><body>{$mark}{$body}</body></html>";
    }

    /** Header/footer: own document like in Chromium, page wide, as high as its margin, without the body CSS. */
    private static function bandShell(string $content, Paper $paper, BigDecimal $height, string $locale): string
    {
        return self::head($locale, '')
            .'<style>html{-webkit-print-color-adjust:exact;print-color-adjust:exact;background:#fff}'
            ."body{margin:0;width:{$paper->pageWidthPx()}px;height:{$height}px;overflow:hidden}</style></head><body>{$content}</body></html>";
    }
}
