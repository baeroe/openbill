<?php

use App\Domain\Conversion\ConversionSource;
use App\Domain\Conversion\DocumentConverter;
use App\Domain\Fields\FieldDefinitionData;
use App\Domain\Money\Decimal;
use App\Domain\Totals\GroupInput;
use App\Domain\Totals\PositionInput;
use App\Enums\DocumentStatus;
use App\Enums\DocumentType;
use App\Enums\FieldScope;
use App\Enums\FieldType;
use App\Enums\PositionKind;

function conversionPos(string $id, PositionKind $kind, string $title, string $quantity, string $price, array $custom = []): PositionInput
{
    return new PositionInput($id, $kind, $title, Decimal::of($quantity), Decimal::of($price), 'u', 'r', $custom);
}

function acceptedOffer(array $over = []): ConversionSource
{
    return new ConversionSource(...array_merge([
        'type' => DocumentType::Offer,
        'status' => DocumentStatus::Accepted,
        'alreadyCancelled' => false,
        'serviceDate' => null,
        'serviceDateEnd' => null,
        'custom' => ['project_name' => 'Shop', 'offer_note' => 'offers only'],
        'groups' => [
            new GroupInput('g1', 'Konzept', [
                conversionPos('p1', PositionKind::Item, 'Workshop', '1', '890', ['ref' => 'A']),
                conversionPos('p2', PositionKind::Optional, 'Extra', '1', '100'),
            ]),
            new GroupInput('g2', 'Nur optional', [conversionPos('p3', PositionKind::Optional, 'Hosting', '12', '49')]),
        ],
    ], $over));
}

/** @return list<FieldDefinitionData> */
function conversionDefs(): array
{
    return [
        new FieldDefinitionData(FieldScope::Document, 'project_name', 'Project', FieldType::Text, docTypes: [DocumentType::Offer, DocumentType::Invoice]),
        new FieldDefinitionData(FieldScope::Document, 'offer_note', 'Offer note', FieldType::Text, docTypes: [DocumentType::Offer]),
        new FieldDefinitionData(FieldScope::Position, 'ref', 'Ref', FieldType::Text, docTypes: [DocumentType::Offer, DocumentType::Invoice]),
    ];
}

it('only converts along the chain and in the right status', function () {
    expect(DocumentConverter::canConvert(DocumentType::Offer, DocumentStatus::Open, false, DocumentType::Invoice))->toBeFalse()
        ->and(DocumentConverter::canConvert(DocumentType::Offer, DocumentStatus::Accepted, false, DocumentType::Invoice))->toBeTrue()
        ->and(DocumentConverter::canConvert(DocumentType::Offer, DocumentStatus::Accepted, false, DocumentType::Cancellation))->toBeFalse()
        ->and(DocumentConverter::canConvert(DocumentType::Confirmation, DocumentStatus::Draft, false, DocumentType::Invoice))->toBeFalse()
        ->and(DocumentConverter::canConvert(DocumentType::Confirmation, DocumentStatus::Done, false, DocumentType::Invoice))->toBeTrue()
        ->and(DocumentConverter::canConvert(DocumentType::Invoice, DocumentStatus::Paid, false, DocumentType::Cancellation))->toBeTrue()
        ->and(DocumentConverter::canConvert(DocumentType::Invoice, DocumentStatus::Open, true, DocumentType::Cancellation))->toBeFalse()
        ->and(DocumentConverter::canConvert(DocumentType::Invoice, DocumentStatus::Draft, false, DocumentType::Cancellation))->toBeFalse();
});

it('keeps groups, drops optional positions and empty groups, keeps fields valid for the target', function () {
    $plan = DocumentConverter::convert(acceptedOffer(), DocumentType::Invoice, 14, conversionDefs(), '2026-10-11');

    expect(array_map(fn ($g) => $g->title, $plan->groups))->toBe(['Konzept'])
        ->and(array_map(fn ($p) => $p->title, $plan->groups[0]->positions))->toBe(['Workshop'])
        ->and($plan->groups[0]->positions[0]->custom)->toBe(['ref' => 'A'])
        ->and($plan->custom)->toBe(['project_name' => 'Shop'])
        ->and($plan->droppedFields)->toBe(['document.offer_note'])
        ->and($plan->dueDate)->toBe('2026-10-25')
        ->and($plan->serviceDate)->toBe('2026-10-11');
});

it('keeps a loose group even when it ends up empty', function () {
    $offer = acceptedOffer(['groups' => [new GroupInput('g0', null, [conversionPos('o', PositionKind::Optional, 'Extra', '1', '1')])]]);

    expect(DocumentConverter::convert($offer, DocumentType::Confirmation, null, conversionDefs(), '2026-10-11')->groups)
        ->toHaveCount(1);
});

it('negates item quantities for cancellations and keeps the service date', function () {
    $invoice = acceptedOffer(['type' => DocumentType::Invoice, 'status' => DocumentStatus::Open, 'serviceDate' => '2026-09-30']);
    $plan = DocumentConverter::convert($invoice, DocumentType::Cancellation, 14, conversionDefs(), '2026-10-11');

    expect((string) $plan->groups[0]->positions[0]->quantity)->toBe('-1')
        ->and($plan->serviceDate)->toBe('2026-09-30')
        ->and($plan->dueDate)->toBeNull()
        ->and($plan->droppedFields)->toBe(['position.ref', 'document.project_name', 'document.offer_note']);
});

it('refuses conversions that are not allowed', function () {
    DocumentConverter::convert(acceptedOffer(['status' => DocumentStatus::Open]), DocumentType::Invoice, 14, conversionDefs(), '2026-10-11');
})->throws(DomainException::class);
