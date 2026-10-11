<?php

namespace App\Domain\Totals;

use Brick\Math\BigDecimal;

final readonly class Totals
{
    /**
     * @param  array<string, LineTotal>  $lines  by position id (text lines have none)
     * @param  array<string, GroupTotal>  $groups  by group id
     * @param  list<TaxBreakdownRow>  $taxBreakdown  highest rate first
     * @param  list<string>  $legalNotes
     * @param  list<string>  $missingTaxRate  position ids
     */
    public function __construct(
        public array $lines,
        public array $groups,
        public array $taxBreakdown,
        public BigDecimal $net,
        public BigDecimal $tax,
        public BigDecimal $gross,
        public BigDecimal $optionalNet,
        public array $legalNotes,
        public array $missingTaxRate,
    ) {}

    /**
     * JSON shape for render/autosave responses: every amount as a string.
     *
     * @return array{lines: array<string, array{net: string, tax_percent: string|null, tax_category: string|null}>, groups: array<string, array{title: string|null, net: string, optional_net: string}>, tax_breakdown: list<array{category: string, percent: string, net: string, tax: string, gross: string}>, net: string, tax: string, gross: string, optional_net: string, legal_notes: list<string>, missing_tax_rate: list<string>}
     */
    public function toArray(): array
    {
        return [
            'lines' => array_map(fn (LineTotal $l): array => [
                'net' => (string) $l->net,
                'tax_percent' => $l->tax === null ? null : (string) $l->tax->percent->strippedOfTrailingZeros(),
                'tax_category' => $l->tax?->category->value,
            ], $this->lines),
            'groups' => array_map(fn (GroupTotal $g): array => [
                'title' => $g->title,
                'net' => (string) $g->net,
                'optional_net' => (string) $g->optionalNet,
            ], $this->groups),
            'tax_breakdown' => array_map(fn (TaxBreakdownRow $r): array => [
                'category' => $r->category->value,
                'percent' => (string) $r->percent->strippedOfTrailingZeros(),
                'net' => (string) $r->net,
                'tax' => (string) $r->tax,
                'gross' => (string) $r->gross,
            ], $this->taxBreakdown),
            'net' => (string) $this->net,
            'tax' => (string) $this->tax,
            'gross' => (string) $this->gross,
            'optional_net' => (string) $this->optionalNet,
            'legal_notes' => $this->legalNotes,
            'missing_tax_rate' => $this->missingTaxRate,
        ];
    }
}
