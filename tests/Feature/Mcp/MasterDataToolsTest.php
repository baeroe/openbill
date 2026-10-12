<?php

use App\Actions\ArchiveTaxRate;
use App\Enums\FieldScope;
use App\Enums\FieldType;
use App\Enums\TextBlockKind;
use App\Mcp\Tools\GetSettingsTool;
use App\Mcp\Tools\ListFieldDefinitionsTool;
use App\Mcp\Tools\ListTaxRatesAndUnitsTool;
use App\Mcp\Tools\ListTextBlocksTool;
use App\Mcp\Tools\SaveFieldDefinitionTool;
use App\Mcp\Tools\UpdateOrganizationTool;
use App\Models\FieldDefinition;
use App\Models\TaxRate;
use App\Models\TextBlock;

beforeEach(fn () => $this->withToken(apiToken(['api:read'])));

it('returns the organization and the document types like the REST API', function () {
    $settings = mcpJson(mcpTool(GetSettingsTool::class)->assertOk());

    expect($settings['organization'])->toBe($this->getJson('/api/organization')->json())
        ->and($settings['document_types'])->toBe($this->getJson('/api/document-types')->json())
        ->and(collect($settings['document_types'])->pluck('type')->all())->toBe(['offer', 'confirmation', 'invoice', 'cancellation']);
});

it('changes the organization and refuses invalid values with their path', function () {
    $organization = mcpJson(mcpTool(UpdateOrganizationTool::class, ['name' => 'Studio Nordlicht', 'iban' => 'DE02120300000000202051', 'country' => 'de'])->assertOk());

    expect($organization)->toMatchArray(['name' => 'Studio Nordlicht', 'iban' => 'DE02120300000000202051', 'country' => 'DE'])
        ->and($organization)->toBe($this->getJson('/api/organization')->json());
    mcpTool(UpdateOrganizationTool::class, ['email' => 'not-an-email'])->assertHasErrors(['- email: ']);
    mcpTool(UpdateOrganizationTool::class, ['taxation_mode' => 'flat'])->assertHasErrors(['- taxation_mode: ']);
});

it('lists the active tax rates and units, archived ones on request', function () {
    $archived = TaxRate::query()->where('percent', '7.00')->sole();
    app(ArchiveTaxRate::class)->handle(systemActor(), $archived);

    $active = mcpJson(mcpTool(ListTaxRatesAndUnitsTool::class)->assertOk());
    $all = mcpJson(mcpTool(ListTaxRatesAndUnitsTool::class, ['include_archived' => true])->assertOk());

    expect($active['tax_rates'])->toBe($this->getJson('/api/tax-rates')->json())
        ->and($active['units'])->toBe($this->getJson('/api/units')->json())
        ->and(collect($active['tax_rates'])->pluck('id'))->not->toContain($archived->id)
        ->and(collect($all['tax_rates'])->pluck('id'))->toContain($archived->id);
});

it('lists text blocks, optionally of one kind', function () {
    TextBlock::factory()->create(['name' => 'Thanks Elbinsel', 'kind' => TextBlockKind::Closing]);
    TextBlock::factory()->create(['name' => 'Hello Fjord', 'kind' => TextBlockKind::Intro]);

    $closing = mcpJson(mcpTool(ListTextBlocksTool::class, ['kind' => 'closing'])->assertOk());

    expect(collect($closing)->pluck('name')->all())->toBe(['Thanks Elbinsel'])
        ->and(mcpJson(mcpTool(ListTextBlocksTool::class)->assertOk()))->toBe($this->getJson('/api/text-blocks')->json());
    mcpTool(ListTextBlocksTool::class, ['kind' => 'footer'])->assertHasErrors(['- kind: ']);
});

it('lists the custom fields like the REST API, filtered by scope and document type', function () {
    FieldDefinition::factory()->create(['scope' => FieldScope::Document, 'key' => 'po_number', 'label' => 'PO number', 'doc_types' => ['invoice']]);
    FieldDefinition::factory()->create(['scope' => FieldScope::Document, 'key' => 'delivery', 'label' => 'Delivery', 'type' => FieldType::Date, 'doc_types' => ['offer']]);

    $invoice = mcpJson(mcpTool(ListFieldDefinitionsTool::class, ['scope' => 'document', 'doc_type' => 'invoice'])->assertOk());

    expect(collect($invoice)->pluck('key')->all())->toBe(['po_number'])
        ->and($invoice)->toBe($this->getJson('/api/field-definitions?scope=document&doc_type=invoice')->json());
    mcpTool(ListFieldDefinitionsTool::class, ['scope' => 'invoice'])->assertHasErrors(['- scope: ']);
});

it('creates and changes a custom field', function () {
    $field = mcpJson(mcpTool(SaveFieldDefinitionTool::class, [
        'scope' => 'document', 'key' => 'po_number', 'label' => 'PO number', 'type' => 'text', 'required' => true, 'doc_types' => ['invoice'],
    ])->assertOk());
    $changed = mcpJson(mcpTool(SaveFieldDefinitionTool::class, ['id' => $field['id'], 'label' => 'Order number'])->assertOk());

    expect($field)->toMatchArray(['scope' => 'document', 'key' => 'po_number', 'type' => 'text', 'required' => true, 'doc_types' => ['invoice']])
        ->and($changed)->toMatchArray(['id' => $field['id'], 'key' => 'po_number', 'label' => 'Order number', 'required' => true]);
    mcpTool(SaveFieldDefinitionTool::class, ['scope' => 'document', 'label' => 'Colour', 'type' => 'colour'])->assertHasErrors(['- type: ']);
    mcpTool(SaveFieldDefinitionTool::class, ['id' => '01jaaaaaaaaaaaaaaaaaaaaaaa', 'label' => 'x'])->assertHasErrors(['There is no custom field']);
});
