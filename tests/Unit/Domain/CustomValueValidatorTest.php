<?php

use App\Domain\Fields\CustomValueValidator;
use App\Domain\Fields\FieldDefinitionData;
use App\Domain\Fields\FieldErrorCode;
use App\Enums\DocumentType;
use App\Enums\FieldScope;
use App\Enums\FieldType;

/** @return list<FieldDefinitionData> */
function valueDefs(): array
{
    $def = fn (string $key, FieldType $type, array $extra = []): FieldDefinitionData => new FieldDefinitionData(...array_merge([
        'scope' => FieldScope::Document, 'key' => $key, 'label' => ucfirst($key), 'type' => $type, 'docTypes' => [DocumentType::Invoice],
    ], $extra));

    return [
        $def('project_name', FieldType::Text),
        $def('hours', FieldType::Number),
        $def('budget', FieldType::Money),
        $def('deadline', FieldType::Date),
        $def('priority', FieldType::Select, ['options' => ['low', 'high']]),
        $def('rush', FieldType::Boolean),
        $def('po_number', FieldType::Text, ['required' => true]),
    ];
}

it('accepts and normalizes valid values', function () {
    $result = CustomValueValidator::validate(valueDefs(), [
        'project_name' => 'Shop', 'hours' => 12, 'budget' => '1500.5', 'deadline' => '2026-10-31',
        'priority' => 'high', 'rush' => false, 'po_number' => 'PO-1',
    ], 'custom.', true);

    expect($result->errors)->toBe([])
        ->and($result->ok())->toBeTrue()
        ->and($result->values)->toBe([
            'project_name' => 'Shop', 'hours' => '12', 'budget' => '1500.5', 'deadline' => '2026-10-31',
            'priority' => 'high', 'rush' => false, 'po_number' => 'PO-1',
        ]);
});

it('reports wrong types with their path', function () {
    $result = CustomValueValidator::validate(valueDefs(), [
        'project_name' => 42, 'hours' => '12,5', 'budget' => 12.5, 'deadline' => '31.10.2026', 'priority' => 'urgent', 'rush' => 'yes',
    ], 'groups.0.positions.1.custom.', false);

    expect(array_map(fn ($e) => [$e->path, $e->code], $result->errors))->toBe([
        ['groups.0.positions.1.custom.project_name', FieldErrorCode::NotText],
        ['groups.0.positions.1.custom.hours', FieldErrorCode::NotNumber],
        ['groups.0.positions.1.custom.budget', FieldErrorCode::NotMoney],
        ['groups.0.positions.1.custom.deadline', FieldErrorCode::NotDate],
        ['groups.0.positions.1.custom.priority', FieldErrorCode::NotOption],
        ['groups.0.positions.1.custom.rush', FieldErrorCode::NotBoolean],
    ]);
});

it('rejects keys that are not defined for the scope or document type', function () {
    $result = CustomValueValidator::validate(valueDefs(), ['offer_note' => 'x'], 'custom.', false);

    expect(array_map(fn ($e) => [$e->path, $e->code, $e->params], $result->errors))
        ->toBe([['custom.offer_note', FieldErrorCode::Unknown, ['key' => 'offer_note']]]);
});

it('checks required fields only when asked and stores blanks as null', function () {
    expect(CustomValueValidator::validate(valueDefs(), ['po_number' => ' '], 'custom.', false)->values)->toBe(['po_number' => null])
        ->and(array_map(fn ($e) => $e->path, CustomValueValidator::validate(valueDefs(), ['po_number' => ' '], 'custom.', true)->errors))
        ->toBe(['custom.po_number']);
});

it('rejects money with more than two decimals and impossible dates', function () {
    $result = CustomValueValidator::validate(valueDefs(), ['budget' => '1.005', 'deadline' => '2026-02-30'], 'custom.', false);

    expect(array_map(fn ($e) => $e->code, $result->errors))->toBe([FieldErrorCode::NotMoney, FieldErrorCode::NotDate]);
});

it('accepts only uploaded image paths for image fields (review focus)', function () {
    $image = [new FieldDefinitionData(scope: FieldScope::Document, key: 'stamp', label: 'Stamp', type: FieldType::Image, docTypes: [DocumentType::Invoice])];
    $check = fn (mixed $value) => CustomValueValidator::validate($image, ['stamp' => $value], 'custom.', false);

    expect($check('uploads/01k9x2m3n4p5q6r7s8t9v0w1y2.png')->ok())->toBeTrue()
        ->and($check('uploads/01k9x2m3n4p5q6r7s8t9v0w1y2.svg')->ok())->toBeTrue();
    foreach (['https://example.com/logo.png', '../../.env', 'uploads/01k9x2m3n4p5q6r7s8t9v0w1y2.exe', 'uploads/short.png', 'logos/01k9x2m3n4p5q6r7s8t9v0w1y2.png'] as $bad) {
        expect($check($bad)->errors[0]->code ?? null)->toBe(FieldErrorCode::NotImage, $bad);
    }
});
