<?php

namespace App\Support;

use App\Domain\Compliance\ComplianceChecker;
use App\Domain\Compliance\ComplianceIssue;
use App\Domain\Totals\Totals;
use App\Domain\Totals\TotalsCalculator;
use App\Models\Document;
use App\Models\DocumentTypeSetting;
use LogicException;

/** Totals and compliance of a document: drafts with live master data, finalized ones with their snapshot. */
final class DocumentInspector
{
    public function __construct(private readonly SnapshotBuilder $snapshots) {}

    /**
     * @return array<string, mixed>
     */
    public function sources(Document $document): array
    {
        if ($document->isFinalized()) {
            // never fall back to live master data: that would silently change a finalized document
            if ($document->snapshot === null) {
                throw new LogicException("Finalized document {$document->id} has no snapshot.");
            }

            return $document->snapshot->data;
        }

        return $this->snapshots->build($document);
    }

    /**
     * @param  array<string, mixed>|null  $sources  pass the snapshot data when it was built already
     */
    public function totals(Document $document, ?array $sources = null): Totals
    {
        $sources ??= $this->sources($document);
        $document->loadMissing('groups.positions');

        return TotalsCalculator::calculate(
            DomainMapper::groups($document),
            DomainMapper::taxContext($sources, LegalNoteTexts::fromSources($sources, $document->locale)),
        );
    }

    /**
     * Issues that block finalizing. A finalized document has none (unless $sources is given).
     *
     * @param  array<string, mixed>|null  $sources
     * @return list<ComplianceIssue>
     */
    public function issues(Document $document, ?array $sources = null): array
    {
        if ($sources === null && $document->isFinalized()) {
            return [];
        }
        $sources ??= $this->sources($document);
        $document->loadMissing('groups.positions');
        $profile = DocumentTypeSetting::query()->findOrFail($document->type->value)->profile;

        return ComplianceChecker::check(DomainMapper::complianceInput($document, $sources, $profile));
    }

    /** Copies the totals into the model's stored columns (not saved). */
    public function applyTotals(Document $document, Totals $totals): void
    {
        $document->forceFill([
            'net_total' => (string) $totals->net,
            'tax_total' => (string) $totals->tax,
            'gross_total' => (string) $totals->gross,
        ]);
    }
}
