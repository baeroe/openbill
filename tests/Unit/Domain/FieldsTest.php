<?php

use App\Domain\Fields\FieldDefinitionData;
use App\Domain\Fields\FieldDefinitionValidator;
use App\Domain\Fields\FieldErrorCode;
use App\Domain\Fields\FieldRegistry;
use App\Domain\Fields\KeySlugger;
use App\Enums\DocumentType;
use App\Enums\FieldScope;
use App\Enums\FieldType;

function fieldDef(array $over = []): FieldDefinitionData
{
    return new FieldDefinitionData(...array_merge([
        'id' => 'x',
        'scope' => FieldScope::Document,
        'key' => 'project_name',
        'label' => 'Projektname',
        'type' => FieldType::Text,
        'docTypes' => [DocumentType::Invoice],
    ], $over));
}

/** @return list<string> */
function fieldErrorCodes(array $errors): array
{
    return array_map(fn ($e) => $e->code->value, $errors);
}

describe('KeySlugger', function () {
    it('transliterates umlauts and snake-cases', function () {
        expect(KeySlugger::slug('Größe der Fläche'))->toBe('groesse_der_flaeche')
            ->and(KeySlugger::slug('  2. Ansprechpartner '))->toBe('f_2_ansprechpartner')
            ->and(KeySlugger::slug('Café Crème'))->toBe('cafe_creme')
            ->and(KeySlugger::slug('!!!'))->toBe('');
    });

    it('accepts only snake_case keys starting with a letter', function () {
        expect(KeySlugger::isValid('po_number'))->toBeTrue()
            ->and(KeySlugger::isValid('PoNumber'))->toBeFalse()
            ->and(KeySlugger::isValid('2nd'))->toBeFalse()
            ->and(KeySlugger::isValid(str_repeat('a', 65)))->toBeFalse();
    });
});

describe('FieldDefinitionValidator', function () {
    it('rejects core keys, duplicates in the same scope and missing doc types', function () {
        expect(fieldErrorCodes(FieldDefinitionValidator::validate(fieldDef(['key' => 'number']), [])))->toBe(['key_reserved'])
            ->and(fieldErrorCodes(FieldDefinitionValidator::validate(fieldDef(['id' => 'y']), [fieldDef()])))->toBe(['key_taken'])
            ->and(fieldErrorCodes(FieldDefinitionValidator::validate(fieldDef(['docTypes' => []]), [])))->toBe(['doc_types_missing']);
    });

    it('allows the same key on another scope', function () {
        expect(FieldDefinitionValidator::validate(fieldDef(['id' => 'y', 'scope' => FieldScope::Customer, 'docTypes' => []]), [fieldDef()]))->toBe([]);
    });

    it('treats a new definition (id null) with an existing key as taken', function () {
        expect(fieldErrorCodes(FieldDefinitionValidator::validate(fieldDef(['id' => null]), [fieldDef()])))->toBe(['key_taken']);
    });

    it('needs a label, a valid key and options for select fields', function () {
        $errors = FieldDefinitionValidator::validate(fieldDef(['label' => ' ', 'key' => 'Bad Key', 'type' => FieldType::Select, 'options' => [' ']]), []);

        expect(array_map(fn ($e) => [$e->path, $e->code], $errors))->toBe([
            ['label', FieldErrorCode::LabelMissing],
            ['key', FieldErrorCode::KeyInvalid],
            ['options', FieldErrorCode::OptionsMissing],
        ]);
    });

    it('checks the default value against the type', function () {
        $errors = FieldDefinitionValidator::validate(fieldDef(['type' => FieldType::Select, 'options' => ['low', 'high'], 'defaultValue' => 'urgent']), []);

        expect(array_map(fn ($e) => [$e->path, $e->code], $errors))->toBe([['default_value', FieldErrorCode::NotOption]]);
    });
});

describe('FieldRegistry', function () {
    it('filters document fields by doc type but not customer fields', function () {
        $defs = [
            fieldDef(['id' => 'a']),
            fieldDef(['id' => 'b', 'key' => 'po', 'docTypes' => [DocumentType::Offer]]),
            fieldDef(['id' => 'c', 'scope' => FieldScope::Customer, 'key' => 'industry', 'docTypes' => []]),
        ];

        expect(array_map(fn ($d) => $d->id, FieldRegistry::forScope($defs, FieldScope::Document, DocumentType::Invoice)))->toBe(['a'])
            ->and(array_map(fn ($d) => $d->id, FieldRegistry::forScope($defs, FieldScope::Customer, DocumentType::Invoice)))->toBe(['c']);
    });

    it('reserves core and structural keys per scope', function () {
        expect(FieldRegistry::isReserved(FieldScope::Document, 'number'))->toBeTrue()
            ->and(FieldRegistry::isReserved(FieldScope::Document, 'groups'))->toBeTrue()
            ->and(FieldRegistry::isReserved(FieldScope::Position, 'kind'))->toBeTrue()
            ->and(FieldRegistry::isReserved(FieldScope::Customer, 'project_name'))->toBeFalse();
    });

    it('collects default values and treats blank strings as empty', function () {
        expect(FieldRegistry::defaults([fieldDef(['defaultValue' => 'Shop']), fieldDef(['key' => 'other'])]))->toBe(['project_name' => 'Shop'])
            ->and(FieldRegistry::isEmpty('  '))->toBeTrue()
            ->and(FieldRegistry::isEmpty(false))->toBeFalse();
    });
});
