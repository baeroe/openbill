<?php

namespace App\Rendering;

use App\Support\Text;
use Brick\Math\BigDecimal;
use Brick\Math\RoundingMode;

/**
 * Page layout from the manifest ("paper"): like Gotenberg/Chromium, the header lives in the top margin,
 * the footer in the bottom margin, the body in between. Lengths are CSS lengths ("20mm").
 */
final readonly class Paper
{
    /** @var array<string, array{0: string, 1: string}> */
    public const FORMATS = ['A4' => ['210mm', '297mm'], 'Letter' => ['8.5in', '11in']];

    /** @var array{format: string, marginX: string, headerHeight: string, footerHeight: string} */
    public const DEFAULT = ['format' => 'A4', 'marginX' => '20mm', 'headerHeight' => '30mm', 'footerHeight' => '20mm'];

    private const LENGTH = '/^(\d+(?:\.\d+)?)(mm|cm|in|pt|px)$/';

    public function __construct(
        public string $format,
        public string $marginX,
        public string $headerHeight,
        public string $footerHeight,
    ) {}

    /**
     * Lenient: invalid or missing values fall back to the defaults (errors() reports them).
     *
     * @param  array<string, mixed>  $manifest
     */
    public static function fromManifest(array $manifest): self
    {
        $paper = is_array($manifest['paper'] ?? null) ? $manifest['paper'] : [];
        $invalid = self::errors($paper);
        $pick = fn (string $key): string => ! isset($invalid["paper.{$key}"]) && is_string($paper[$key] ?? null)
            ? $paper[$key]
            : self::DEFAULT[$key];

        return new self($pick('format'), $pick('marginX'), $pick('headerHeight'), $pick('footerHeight'));
    }

    /**
     * Problems of a manifest's "paper" value by path (paper.format, paper.marginX, …); null = not set = fine.
     *
     * @return array<string, string>
     */
    public static function errors(mixed $paper): array
    {
        if ($paper === null) {
            return [];
        }
        if (! is_array($paper)) {
            return ['paper' => Text::t('template_package.paper_invalid')];
        }

        $errors = [];
        if (isset($paper['format']) && (! is_string($paper['format']) || ! array_key_exists($paper['format'], self::FORMATS))) {
            $errors['paper.format'] = Text::t('template_package.paper_format', ['formats' => implode(', ', array_keys(self::FORMATS))]);
        }
        foreach (['marginX', 'headerHeight', 'footerHeight'] as $key) {
            if (isset($paper[$key]) && (! is_string($paper[$key]) || preg_match(self::LENGTH, $paper[$key]) !== 1)) {
                $errors["paper.{$key}"] = Text::t('template_package.paper_length', ['key' => $key]);
            }
        }

        return $errors;
    }

    /** CSS pixels at 96 dpi, two decimals (what Chromium uses for print layout). */
    public static function lengthToPx(string $length): BigDecimal
    {
        if (preg_match(self::LENGTH, $length, $m) !== 1) {
            return BigDecimal::zero()->toScale(2);
        }
        [$numerator, $denominator] = match ($m[2]) {
            'mm' => ['96', '25.4'],
            'cm' => ['96', '2.54'],
            'in' => ['96', '1'],
            'pt' => ['96', '72'],
            default => ['1', '1'],
        };

        return BigDecimal::of($m[1])->multipliedBy($numerator)->dividedBy($denominator, 2, RoundingMode::HalfUp);
    }

    /** @return array{0: string, 1: string} width, height for Gotenberg */
    public function size(): array
    {
        return self::FORMATS[$this->format] ?? self::FORMATS['A4'];
    }

    public function pageWidthPx(): BigDecimal
    {
        return self::lengthToPx($this->size()[0]);
    }

    public function contentWidthPx(): BigDecimal
    {
        return $this->pageWidthPx()->minus(self::lengthToPx($this->marginX)->multipliedBy(2));
    }

    public function headerHeightPx(): BigDecimal
    {
        return self::lengthToPx($this->headerHeight);
    }

    public function footerHeightPx(): BigDecimal
    {
        return self::lengthToPx($this->footerHeight);
    }

    /**
     * @return array{format: string, marginX: string, headerHeight: string, footerHeight: string}
     */
    public function toArray(): array
    {
        return ['format' => $this->format, 'marginX' => $this->marginX, 'headerHeight' => $this->headerHeight, 'footerHeight' => $this->footerHeight];
    }
}
