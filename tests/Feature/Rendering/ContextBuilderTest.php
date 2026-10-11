<?php

use App\Actions\ConvertDocument;
use App\Actions\FinalizeDocument;
use App\Actions\SetDocumentStatus;
use App\Contracts\DocumentArchiver;
use App\Domain\Fields\FieldRegistry;
use App\Enums\DocumentStatus;
use App\Enums\DocumentType;
use App\Enums\FieldScope;
use App\Models\Contact;
use App\Models\Customer;
use App\Models\Document;
use App\Models\DocumentTypeSetting;
use App\Models\FieldDefinition;
use App\Models\Organization;
use App\Models\Template;
use App\Rendering\ContextBuilder;
use App\Support\DocumentInspector;
use App\Support\DraftInput;
use App\Support\DraftOverlay;
use App\Support\NullDocumentArchiver;
use App\Support\SnapshotBuilder;
use App\Support\TemplateResolver;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;

function contextOf(Document $document): array
{
    $document->loadMissing('groups.positions');

    return app(ContextBuilder::class)->build($document, app(DocumentInspector::class)->sources($document))->data;
}

function groupedDraft(): Document
{
    $customer = Customer::factory()->create(['name' => 'Hafenkontor Lindqvist GmbH', 'number' => 'K-1001']);
    Contact::factory()->for($customer)->create(['first_name' => 'Mira', 'last_name' => 'Albers', 'is_default' => true]);

    return draft(DocumentType::Invoice, [], [
        'customer_id' => $customer->id,
        'groups' => [
            ['title' => 'Konzept', 'positions' => [itemRow('Workshop', '10', '95'), ['kind' => 'text', 'title' => 'Inklusive Protokoll', 'quantity' => '0', 'unit_price' => '0', 'unit_id' => null, 'tax_rate_id' => null, 'custom' => []]]],
            ['title' => null, 'positions' => [itemRow('Hosting', '1', '49.5')]],
        ],
    ]);
}

it('builds the context of a draft from live master data', function () {
    $context = contextOf(groupedDraft());

    expect($context['document'])->toMatchArray([
        'type' => 'invoice',
        'type_label' => 'Invoice',
        'status' => 'draft',
        'number' => 'Draft',
        'locale' => 'en',
        'net_total' => '999.50',
        'tax_total' => '189.91',
        'gross_total' => '1189.41',
        'optional_total' => '0.00',
        'source_number' => null,
    ])
        ->and($context['document']['tax_breakdown'])->toBe([['category' => 'S', 'percent' => '19', 'net' => '999.50', 'tax' => '189.91', 'gross' => '1189.41']])
        ->and($context['customer'])->toMatchArray(['name' => 'Hafenkontor Lindqvist GmbH', 'number' => 'K-1001', 'tax_treatment' => 'domestic'])
        ->and($context['contact'])->toMatchArray(['first_name' => 'Mira', 'full_name' => 'Mira Albers'])
        ->and($context['groups'][0])->toMatchArray(['title' => 'Konzept', 'has_title' => true, 'total' => '950.00', 'optional_total' => '0.00'])
        ->and($context['groups'][1])->toMatchArray(['title' => '', 'has_title' => false, 'total' => '49.50'])
        ->and($context['positions'])->toHaveCount(3)
        ->and($context['positions'][0])->toMatchArray([
            'index' => 1, 'kind' => 'item', 'is_item' => true, 'is_text' => false, 'is_optional' => false, 'title' => 'Workshop',
            'quantity' => '10', 'unit' => 'h', 'unit_name' => 'Hour', 'unit_code' => 'HUR', 'unit_price' => '95.00',
            'tax_percent' => '19', 'total' => '950.00', 'group' => 'Konzept',
        ])
        ->and($context['positions'][1])->toMatchArray(['index' => null, 'is_text' => true, 'title' => 'Inklusive Protokoll'])
        ->and($context['positions'][2])->toMatchArray(['index' => 2, 'unit_price' => '49.50', 'group' => '']);
});

it('puts custom fields directly on their object and never lets them override core values', function () {
    FieldDefinition::factory()->create(['scope' => FieldScope::Document, 'key' => 'project_name', 'label' => 'Project', 'doc_types' => ['invoice']]);
    $document = groupedDraft();
    $document->forceFill(['custom' => ['project_name' => 'Relaunch', 'number' => 'FAKE']])->save();
    Customer::query()->whereKey($document->customer_id)->update(['custom' => json_encode(['industry' => 'Handel', 'name' => 'Evil'])]);

    $context = contextOf($document->fresh());

    expect($context['document']['project_name'])->toBe('Relaunch')
        ->and($context['document']['number'])->toBe('Draft')
        ->and($context['customer']['industry'])->toBe('Handel')
        ->and($context['customer']['name'])->toBe('Hafenkontor Lindqvist GmbH');
});

it('only uses reserved keys for core values, so a custom field can never be shadowed silently', function () {
    $context = contextOf(groupedDraft());
    $levels = ['org' => FieldScope::Org, 'customer' => FieldScope::Customer, 'contact' => FieldScope::Contact, 'document' => FieldScope::Document];

    foreach ($levels as $level => $scope) {
        foreach (array_keys($context[$level]) as $key) {
            expect(FieldRegistry::isReserved($scope, $key))->toBeTrue("{$level}.{$key} is not reserved");
        }
    }
    foreach (array_keys($context['positions'][0]) as $key) {
        expect(FieldRegistry::isReserved(FieldScope::Position, $key))->toBeTrue("position.{$key} is not reserved");
    }
});

it('uses the snapshot for a finalized document', function () {
    // the archiver is not what this test is about (task 11 covers it)
    app()->bind(DocumentArchiver::class, NullDocumentArchiver::class);
    $done = app(FinalizeDocument::class)->handle(systemActor(), groupedDraft());
    Customer::query()->whereKey($done->customer_id)->update(['name' => 'Renamed']);

    expect(contextOf($done->fresh())['customer']['name'])->toBe('Hafenkontor Lindqvist GmbH');
});

it('shows the number of the source document', function () {
    app()->bind(DocumentArchiver::class, NullDocumentArchiver::class);
    $offer = app(FinalizeDocument::class)->handle(systemActor(), draft(DocumentType::Offer));
    app(SetDocumentStatus::class)->handle(systemActor(), $offer, DocumentStatus::Accepted);
    $invoice = app(ConvertDocument::class)->handle(systemActor(), $offer->fresh(), DocumentType::Invoice)->document;

    expect(contextOf($invoice)['document']['source_number'])->toBe($offer->number);
});

it('embeds the organization logo as data URL', function () {
    Storage::disk('local')->put('logos/nordlicht.png', 'PNGDATA');
    Organization::current()->forceFill(['logo_path' => 'logos/nordlicht.png'])->save();

    expect(contextOf(groupedDraft())['org']['logo'])->toStartWith('data:')->toEndWith(';base64,'.base64_encode('PNGDATA'));
});

it('previews unsaved draft changes without writing them', function () {
    $document = groupedDraft();
    $rows = [['title' => 'Neu', 'positions' => [itemRow('Workshop', '2', '100')]]];
    $virtual = DraftOverlay::apply($document, DraftInput::validate($document, ['intro' => 'Unsaved', 'groups' => $rows]));

    $context = app(ContextBuilder::class)->build($virtual, app(DocumentInspector::class)->sources($virtual))->data;

    expect($context['document']['intro'])->toBe('Unsaved')
        ->and($context['document']['net_total'])->toBe('200.00')
        ->and($context['groups'][0]['title'])->toBe('Neu')
        ->and($document->fresh()->intro)->not->toBe('Unsaved')
        ->and($document->fresh()->net_total)->toBe('999.50')
        ->and(fn () => DraftInput::validate($document, ['groups' => [['positions' => [['kind' => 'item', 'quantity' => 12.5]]]]]))
        ->toThrow(ValidationException::class);
});

it('resolves the template: document, then document type, then the built-in fallback', function () {
    $own = Template::factory()->create();
    $typeDefault = Template::factory()->create();
    $document = groupedDraft();

    DocumentTypeSetting::query()->whereKey('invoice')->update(['template_id' => $typeDefault->id]);
    expect(TemplateResolver::for($document->fresh())?->id)->toBe($document->template_id ?? $typeDefault->id);

    $document->forceFill(['template_id' => null])->save();
    expect(TemplateResolver::for($document->fresh())?->id)->toBe($typeDefault->id);

    $document->forceFill(['template_id' => $own->id])->save();
    expect(TemplateResolver::for($document->fresh())?->id)->toBe($own->id)
        ->and(app(SnapshotBuilder::class)->build($document->fresh())['template']['id'])->toBe($own->id);
});
