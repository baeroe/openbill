<?php

namespace App\Rendering;

use App\EInvoice\CiiBuilder;
use App\Enums\ComplianceProfile;
use App\Enums\DocumentType;
use App\Enums\RenderPart;
use App\Exceptions\EInvoiceInvalidException;
use App\Exceptions\PdfRenderFailedException;
use App\Exceptions\TemplateRenderFailedException;
use App\Models\Document;
use App\Models\DocumentTypeSetting;
use App\Support\Text;

/**
 * Document → context → HTML parts (+ e-invoice XML) → PDF. Used by the archiver while finalizing and by
 * the live draft download. Template errors never reach Gotenberg.
 */
final class DocumentRenderer
{
    public function __construct(
        private readonly ContextBuilder $contexts,
        private readonly LiquidRenderer $renderer,
        private readonly GotenbergClient $gotenberg,
        private readonly CiiBuilder $cii,
    ) {}

    /**
     * @param  array<string, mixed>  $sources  snapshot-shaped (the snapshot when finalizing, SnapshotBuilder for drafts)
     * @param  bool  $draft  live draft PDF: watermark, no e-invoice, no PDF/A
     *
     * @throws TemplateRenderFailedException|EInvoiceInvalidException|PdfRenderFailedException
     */
    public function render(Document $document, array $sources, bool $draft): RenderedDocument
    {
        if (! is_array($sources['template'] ?? null)) {
            throw new TemplateRenderFailedException([new RenderError(RenderPart::Body, null, Text::t('rendering.error.no_template'))]);
        }

        $context = $this->contexts->build($document, $sources);
        $mark = $draft ? mb_strtoupper(Text::t('template.draft', [], $document->locale)) : null;
        $result = $this->renderer->render(TemplateSource::fromSnapshot($sources['template']), $context->data, new RenderOptions($document->locale, $mark));
        if (! $result->ok()) {
            throw new TemplateRenderFailedException($result->errors);
        }

        $xml = ! $draft && self::isEInvoice($document) ? $this->cii->build($document, $sources, $context->totals) : null;

        return new RenderedDocument($this->gotenberg->pdf($result, $xml), $xml);
    }

    /** Invoices and cancellations whose document type uses the EN 16931 profile. */
    public static function isEInvoice(Document $document): bool
    {
        return in_array($document->type, [DocumentType::Invoice, DocumentType::Cancellation], true)
            && DocumentTypeSetting::query()->find($document->type->value)?->profile === ComplianceProfile::En16931;
    }
}
