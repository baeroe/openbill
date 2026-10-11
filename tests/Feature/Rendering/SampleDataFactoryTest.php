<?php

use App\Enums\FieldScope;
use App\Enums\FieldType;
use App\Enums\RenderScenario;
use App\Models\Document;
use App\Models\FieldDefinition;
use App\Models\Organization;
use App\Rendering\ContextBuilder;
use App\Rendering\SampleDataFactory;
use App\Support\Text;

/** @return array<string, mixed> */
function sampleContext(RenderScenario $scenario, string $locale = 'de'): array
{
    $sample = app(SampleDataFactory::class)->make($scenario, $locale);

    return app(ContextBuilder::class)->build($sample->document, $sample->sources)->data;
}

it('is deterministic and writes nothing', function (RenderScenario $scenario) {
    expect(sampleContext($scenario))->toBe(sampleContext($scenario))
        ->and(Document::query()->count())->toBe(0);
})->with(RenderScenario::cases());

it('fills an empty organization with the fictional sample organization', function () {
    expect(sampleContext(RenderScenario::ShortInvoice)['org'])->toMatchArray(['name' => 'Studio Nordlicht', 'city' => 'Hamburg', 'small_business' => false]);

    Organization::current()->forceFill(['name' => 'Kulturwerk Elbinsel e. V.', 'city' => 'Hamburg'])->save();
    expect(sampleContext(RenderScenario::ShortInvoice)['org']['name'])->toBe('Kulturwerk Elbinsel e. V.');
});

it('covers a short invoice', function () {
    $context = sampleContext(RenderScenario::ShortInvoice);

    expect($context['document'])->toMatchArray(['type' => 'invoice', 'number' => 'INV-2026-0042', 'date' => '2026-10-01', 'due_date' => '2026-10-15', 'service_date' => '2026-09-30', 'net_total' => '5450.00', 'tax_total' => '1035.50', 'gross_total' => '6485.50'])
        ->and($context['positions'])->toHaveCount(3)
        ->and($context['groups'])->toHaveCount(1)
        ->and($context['groups'][0]['has_title'])->toBeFalse()
        ->and($context['customer']['name'])->toBe('Hafenkontor Lindqvist GmbH')
        ->and($context['contact']['full_name'])->toBe('Mira Albers');
});

it('covers a long invoice over several groups', function () {
    $context = sampleContext(RenderScenario::LongInvoice);

    expect($context['groups'])->toHaveCount(4)
        ->and(count($context['positions']))->toBe(49)
        ->and(array_filter($context['positions'], fn (array $p): bool => $p['is_text']))->toHaveCount(1)
        ->and($context['groups'][0]['has_title'])->toBeTrue();
});

it('covers small business and reverse charge with their legal notes', function () {
    $small = sampleContext(RenderScenario::SmallBusiness);
    $reverse = sampleContext(RenderScenario::ReverseCharge);

    expect($small['org']['small_business'])->toBeTrue()
        ->and($small['document']['tax_total'])->toBe('0.00')
        ->and($small['document']['legal_notes'])->toBe([Text::t('legal.small_business', [], 'de')])
        ->and($reverse['customer'])->toMatchArray(['name' => 'Hotel Alpenglück', 'country' => 'AT', 'vat_id' => 'ATU12345678', 'tax_treatment' => 'eu_reverse_charge'])
        ->and($reverse['document']['tax_breakdown'][0]['category'])->toBe('AE')
        ->and($reverse['document']['legal_notes'])->toBe([Text::t('legal.reverse_charge', [], 'de')]);
});

it('covers an offer with optional positions', function () {
    $context = sampleContext(RenderScenario::OfferWithOptions, 'en');

    expect($context['document'])->toMatchArray(['type' => 'offer', 'type_label' => 'Quote', 'number' => 'Q-2026-0042', 'valid_until' => '2026-10-31', 'due_date' => null, 'optional_total' => '1788.00'])
        ->and(array_column($context['positions'], 'is_optional'))->toContain(true)
        ->and($context['groups'][1]['optional_total'])->toBe('1788.00');
});

it('fills custom fields from their definitions', function () {
    FieldDefinition::factory()->create(['scope' => FieldScope::Document, 'key' => 'project_name', 'label' => 'Projektname', 'type' => FieldType::Text, 'doc_types' => ['invoice']]);
    FieldDefinition::factory()->create(['scope' => FieldScope::Document, 'key' => 'response_time', 'label' => 'Reaktionszeit', 'type' => FieldType::Select, 'options' => ['24 Stunden', '48 Stunden'], 'doc_types' => ['offer']]);
    FieldDefinition::factory()->create(['scope' => FieldScope::Position, 'key' => 'ticket', 'label' => 'Ticket', 'type' => FieldType::Text, 'default_value' => 'SHOP-142', 'doc_types' => ['invoice']]);
    FieldDefinition::factory()->create(['scope' => FieldScope::Customer, 'key' => 'supplier_number', 'label' => 'Lieferantennummer', 'type' => FieldType::Number, 'doc_types' => []]);

    $invoice = sampleContext(RenderScenario::ShortInvoice);
    $offer = sampleContext(RenderScenario::OfferWithOptions);

    expect($invoice['document']['project_name'])->toBe('Projektname')
        ->and($invoice['document'])->not->toHaveKey('response_time')
        ->and($offer['document']['response_time'])->toBe('24 Stunden')
        ->and($invoice['positions'][0]['ticket'])->toBe('SHOP-142')
        ->and($invoice['customer']['supplier_number'])->toBe('42');
});
