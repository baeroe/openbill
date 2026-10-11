<?php

use App\Enums\DocumentStatus;
use App\Enums\DocumentType;
use App\Enums\TaxTreatment;
use App\Models\Customer;
use App\Models\FieldDefinition;
use App\Models\Organization;
use App\Models\TaxRate;
use App\Models\Template;
use App\Models\Unit;
use App\Support\DocumentInspector;
use App\Support\SnapshotBuilder;

it('computes draft totals from the current master data', function () {
    $document = draftDocument(DocumentType::Invoice, [itemRow('Consulting', '10', '95')]);
    $totals = app(DocumentInspector::class)->totals($document);

    expect((string) $totals->net)->toBe('950.00')
        ->and((string) $totals->tax)->toBe('180.50')
        ->and((string) $totals->gross)->toBe('1130.50');
});

it('uses the reverse charge note in the document language', function () {
    $customer = Customer::factory()->create(['tax_treatment' => TaxTreatment::EuReverseCharge]);
    $document = draftDocument(DocumentType::Invoice, [itemRow()], ['customer_id' => $customer->id, 'locale' => 'de']);

    expect(app(DocumentInspector::class)->totals($document)->legalNotes)
        ->toBe(['Steuerschuldnerschaft des Leistungsempfängers (Reverse Charge).']);
});

it('puts every master data level into the snapshot', function () {
    $template = Template::factory()->create();
    FieldDefinition::factory()->create(['key' => 'project_name']);
    $document = draftDocument(DocumentType::Invoice, [itemRow()], ['template_id' => $template->id]);

    $data = app(SnapshotBuilder::class)->build($document);

    expect($data)->toHaveKeys(['org', 'customer', 'contact', 'tax_rates', 'units', 'template', 'field_definitions'])
        ->and($data['customer']['id'])->toBe($document->customer_id)
        ->and($data['contact'])->toBeNull()
        ->and($data['org']['taxation_mode'])->toBe('regular')
        ->and($data['tax_rates'][0])->toMatchArray(['label' => '19 %', 'percent' => '19.00', 'category' => 'S', 'archived' => false])
        ->and($data['units'][0])->toMatchArray(['code' => 'HUR'])
        ->and($data['template']['id'])->toBe($template->id)
        ->and($data['field_definitions'][0])->toMatchArray(['key' => 'project_name', 'scope' => 'document']);
});

it('computes finalized documents from their snapshot, not from changed master data', function () {
    $document = draftDocument(DocumentType::Invoice, [itemRow('Consulting', '10', '95')]);
    $data = app(SnapshotBuilder::class)->build($document);
    $document->forceFill(['number' => 'INV-1', 'status' => DocumentStatus::Open, 'finalized_at' => now()])->save();
    $document->snapshot()->create(['data' => $data]);

    TaxRate::query()->whereKey(vatRateId())->update(['percent' => '25.00']);
    Organization::current()->forceFill(['taxation_mode' => 'small_business'])->save();
    Unit::query()->update(['code' => '']);

    $fresh = $document->fresh();
    expect((string) app(DocumentInspector::class)->totals($fresh)->tax)->toBe('180.50')
        ->and(app(DocumentInspector::class)->sources($fresh)['tax_rates'][0]['percent'])->toBe('19.00')
        ->and(app(DocumentInspector::class)->issues($fresh))->toBe([]);
});

it('reports compliance issues of drafts with paths', function () {
    $document = draftDocument(DocumentType::Invoice, [itemRow('Consulting', '1', '100', ['unit_id' => null])], ['customer_id' => null]);

    expect(array_map(fn ($i) => $i->path, app(DocumentInspector::class)->issues($document)))
        ->toBe(['document.customer', 'positions.'.$document->groups[0]->positions[0]->id.'.unit']);
});
