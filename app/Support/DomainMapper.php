<?php

namespace App\Support;

use App\Domain\Compliance\ComplianceInput;
use App\Domain\Compliance\PartyFacts;
use App\Domain\Conversion\ConversionSource;
use App\Domain\Fields\FieldDefinitionData;
use App\Domain\Money\Decimal;
use App\Domain\Tax\LegalNotes;
use App\Domain\Tax\TaxContext;
use App\Domain\Tax\TaxRateData;
use App\Domain\Totals\GroupInput;
use App\Domain\Totals\PositionInput;
use App\Enums\ComplianceProfile;
use App\Enums\DocumentType;
use App\Enums\FieldScope;
use App\Enums\FieldType;
use App\Enums\SupplyType;
use App\Enums\TaxationMode;
use App\Enums\TaxCategory;
use App\Enums\TaxTreatment;
use App\Models\Document;
use App\Models\Position;
use App\Models\PositionGroup;

/** Models and snapshot arrays → domain input objects (and back for position rows). */
final class DomainMapper
{
    /** @return list<GroupInput> */
    public static function groups(Document $document): array
    {
        return $document->groups->map(fn (PositionGroup $group): GroupInput => new GroupInput(
            $group->id,
            $group->title,
            $group->positions->map(fn (Position $p): PositionInput => self::position($p))->values()->all(),
        ))->values()->all();
    }

    public static function position(Position $position): PositionInput
    {
        return new PositionInput(
            id: $position->id,
            kind: $position->kind,
            title: $position->title,
            quantity: Decimal::of($position->quantity),
            unitPrice: Decimal::of($position->unit_price),
            unitId: $position->unit_id,
            taxRateId: $position->tax_rate_id,
            custom: $position->custom ?? [],
            description: $position->description ?? '',
        );
    }

    /**
     * @param  array<string, mixed>  $sources  snapshot-shaped (SnapshotBuilder)
     */
    public static function taxContext(array $sources, LegalNotes $notes): TaxContext
    {
        $rates = array_map(fn (array $r): TaxRateData => new TaxRateData(
            $r['id'],
            Decimal::of($r['percent']),
            TaxCategory::from($r['category']),
            $r['exemption_note'] ?? null,
        ), $sources['tax_rates']);

        return new TaxContext(
            array_values($rates),
            TaxationMode::from($sources['org']['taxation_mode']),
            TaxTreatment::from($sources['customer']['tax_treatment'] ?? TaxTreatment::Domestic->value),
            $notes,
            // snapshots finalized before phase 7 have no supply type and were exports (G)
            SupplyType::from($sources['customer']['supply_type'] ?? SupplyType::Goods->value),
        );
    }

    /**
     * @param  list<array<string, mixed>>  $rows  SnapshotBuilder::fieldDefinitionRows() shape
     * @return list<FieldDefinitionData>
     */
    public static function fieldDefinitions(array $rows): array
    {
        return array_map(fn (array $row): FieldDefinitionData => new FieldDefinitionData(
            scope: FieldScope::from($row['scope']),
            key: $row['key'],
            label: $row['label'],
            type: FieldType::from($row['type']),
            required: (bool) $row['required'],
            defaultValue: $row['default_value'] ?? null,
            options: array_values($row['options'] ?? []),
            docTypes: array_values(array_map(fn (string $t): DocumentType => DocumentType::from($t), $row['doc_types'] ?? [])),
            id: $row['id'] ?? null,
        ), $rows);
    }

    /** @return list<FieldDefinitionData> */
    public static function currentFieldDefinitions(): array
    {
        return self::fieldDefinitions(SnapshotBuilder::fieldDefinitionRows());
    }

    /**
     * @param  array<string, mixed>  $row  "org" or "customer" from a snapshot
     */
    public static function party(array $row): PartyFacts
    {
        return new PartyFacts(
            name: (string) ($row['name'] ?? ''),
            street: (string) ($row['street'] ?? ''),
            zip: (string) ($row['zip'] ?? ''),
            city: (string) ($row['city'] ?? ''),
            country: (string) ($row['country'] ?? ''),
            vatId: (string) ($row['vat_id'] ?? ''),
            taxNumber: (string) ($row['tax_number'] ?? ''),
            iban: (string) ($row['iban'] ?? ''),
            custom: $row['custom'] ?? [],
            taxTreatment: isset($row['tax_treatment']) ? TaxTreatment::from($row['tax_treatment']) : null,
            registrationId: (string) ($row['registration_id'] ?? ''),
            supplyType: isset($row['supply_type']) ? SupplyType::from($row['supply_type']) : null,
        );
    }

    /**
     * @param  array<string, mixed>  $sources
     */
    public static function complianceInput(Document $document, array $sources, ComplianceProfile $profile): ComplianceInput
    {
        return new ComplianceInput(
            type: $document->type,
            profile: $profile,
            taxationMode: TaxationMode::from($sources['org']['taxation_mode']),
            date: $document->date->toDateString(),
            serviceDate: $document->service_date?->toDateString(),
            dueDate: $document->due_date?->toDateString(),
            custom: $document->custom ?? [],
            groups: self::groups($document),
            org: self::party($sources['org']),
            customer: $sources['customer'] === null ? null : self::party($sources['customer']),
            contactCustom: $sources['contact'] === null ? null : ($sources['contact']['custom'] ?? []),
            unitCodes: array_column($sources['units'], 'code', 'id'),
            taxRateIds: array_column($sources['tax_rates'], 'id'),
            fieldDefinitions: self::fieldDefinitions($sources['field_definitions']),
        );
    }

    public static function conversionSource(Document $document): ConversionSource
    {
        return new ConversionSource(
            type: $document->type,
            status: $document->status,
            alreadyCancelled: $document->cancelled_by_id !== null,
            serviceDate: $document->service_date?->toDateString(),
            serviceDateEnd: $document->service_date_end?->toDateString(),
            custom: $document->custom ?? [],
            groups: self::groups($document),
        );
    }

    /**
     * Rows for GroupWriter::replace(); ids are left out so the new document gets fresh ones.
     *
     * @param  list<GroupInput>  $groups
     * @return list<array<string, mixed>>
     */
    public static function groupRows(array $groups): array
    {
        return array_map(fn (GroupInput $group): array => [
            'title' => $group->title,
            'positions' => array_map(fn (PositionInput $p): array => [
                'kind' => $p->kind->value,
                'title' => $p->title,
                'description' => $p->description,
                'quantity' => (string) $p->quantity,
                'unit_price' => (string) $p->unitPrice,
                'unit_id' => $p->unitId,
                'tax_rate_id' => $p->taxRateId,
                'custom' => $p->custom,
            ], $group->positions),
        ], $groups);
    }
}
