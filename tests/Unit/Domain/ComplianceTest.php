<?php

use App\Domain\Compliance\ComplianceChecker;
use App\Domain\Compliance\ComplianceInput;
use App\Domain\Compliance\PartyFacts;
use App\Domain\Fields\FieldDefinitionData;
use App\Domain\Money\Decimal;
use App\Domain\Totals\GroupInput;
use App\Domain\Totals\PositionInput;
use App\Enums\ComplianceProfile;
use App\Enums\DocumentType;
use App\Enums\FieldScope;
use App\Enums\FieldType;
use App\Enums\PositionKind;
use App\Enums\TaxationMode;
use App\Enums\TaxTreatment;

function complianceItem(array $over = []): PositionInput
{
    return new PositionInput(...array_merge([
        'id' => 'p1', 'kind' => PositionKind::Item, 'title' => 'X', 'quantity' => Decimal::of('1'),
        'unitPrice' => Decimal::of('1'), 'unitId' => 'u', 'taxRateId' => 'r',
    ], $over));
}

/** @return list<string> */
function compliancePaths(array $over = [], array $positions = []): array
{
    $input = new ComplianceInput(...array_merge([
        'type' => DocumentType::Offer,
        'profile' => ComplianceProfile::Basic,
        'taxationMode' => TaxationMode::Regular,
        'date' => '2026-10-04',
        'serviceDate' => null,
        'dueDate' => null,
        'custom' => [],
        'groups' => [new GroupInput('g', null, $positions === [] ? [complianceItem()] : $positions)],
        'org' => new PartyFacts('O', 's', 'z', 'c', 'DE', vatId: 'DE1', iban: 'X'),
        'customer' => new PartyFacts('C', 's', 'z', 'c', 'DE', taxTreatment: TaxTreatment::Domestic),
        'contactCustom' => null,
        'unitCodes' => ['u' => 'HUR'],
        'taxRateIds' => ['r'],
        'fieldDefinitions' => [],
    ], $over));

    return array_map(fn ($issue) => $issue->path, ComplianceChecker::check($input));
}

it('passes a complete offer', function () {
    expect(compliancePaths())->toBe([]);
});

it('requires a date and a customer', function () {
    expect(compliancePaths(['date' => null, 'customer' => null]))->toBe(['document.date', 'document.customer']);
});

it('requires at least one item', function () {
    expect(compliancePaths([], [complianceItem(['kind' => PositionKind::Text])]))->toBe(['positions']);
});

it('reports a deleted unit and tax rate', function () {
    expect(compliancePaths([], [complianceItem(['unitId' => 'gone', 'taxRateId' => 'gone'])]))
        ->toBe(['positions.p1.tax_rate', 'positions.p1.unit']);
});

it('does not ask small businesses for a tax rate', function () {
    expect(compliancePaths(['taxationMode' => TaxationMode::SmallBusiness], [complianceItem(['taxRateId' => null])]))->toBe([]);
});

it('checks required document fields only for their doc types', function () {
    $def = new FieldDefinitionData(FieldScope::Document, 'po_number', 'Bestellnummer', FieldType::Text, required: true, docTypes: [DocumentType::Invoice]);

    expect(compliancePaths(['fieldDefinitions' => [$def]]))->toBe([])
        ->and(compliancePaths(['fieldDefinitions' => [$def], 'type' => DocumentType::Invoice]))->toContain('document.custom.po_number');
});

it('checks required fields on every level', function () {
    $defs = [
        new FieldDefinitionData(FieldScope::Org, 'register', 'Register', FieldType::Text, required: true),
        new FieldDefinitionData(FieldScope::Customer, 'industry', 'Industry', FieldType::Text, required: true),
        new FieldDefinitionData(FieldScope::Contact, 'department', 'Department', FieldType::Text, required: true),
        new FieldDefinitionData(FieldScope::Position, 'ticket', 'Ticket', FieldType::Text, required: true, docTypes: [DocumentType::Offer]),
    ];

    expect(compliancePaths(['fieldDefinitions' => $defs, 'contactCustom' => []]))
        ->toBe(['org.register', 'customer.industry', 'contact.department', 'positions.p1.custom.ticket']);
});

it('requires service date and due date for e-invoices', function () {
    expect(compliancePaths(['type' => DocumentType::Invoice, 'profile' => ComplianceProfile::En16931]))
        ->toBe(['document.service_date', 'document.due_date']);
});

it('checks organization, customer and units for e-invoices', function () {
    $paths = compliancePaths([
        'type' => DocumentType::Cancellation,
        'profile' => ComplianceProfile::En16931,
        'serviceDate' => '2026-10-01',
        'org' => new PartyFacts('O', '', 'z', 'c', 'DE'),
        'customer' => new PartyFacts('C', 's', '', 'c', 'SE', taxTreatment: TaxTreatment::EuReverseCharge),
        'unitCodes' => ['u' => ''],
    ], [complianceItem(['quantity' => Decimal::of('0')])]);

    expect($paths)->toBe([
        'org.address', 'org.vat_id', 'org.iban', 'customer.address', 'customer.vat_id',
        'positions.p1.unit', 'positions.p1.quantity',
    ]);
});
