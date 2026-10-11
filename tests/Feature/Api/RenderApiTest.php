<?php

use App\Actions\FinalizeDocument;
use App\Enums\DocumentType;
use App\Enums\FieldScope;
use App\Models\Customer;
use App\Models\FieldDefinition;

beforeEach(fn () => $this->withToken(apiToken(['templates:render'])));

it('renders a sample scenario in the shape of the phase 3 interface', function () {
    $json = $this->postJson('/api/render', ['scenario' => 'short_invoice', 'locale' => 'de'])->assertOk()->json();

    expect(array_keys($json))->toBe(['header', 'body', 'footer', 'paper', 'errors', 'totals', 'issues'])
        ->and($json['errors'])->toBe([])
        ->and($json['totals']['gross'])->toBe('6485.50')
        ->and($json['body'])->toContain('Hafenkontor Lindqvist GmbH');
});

it('answers a broken template with 200 and readable errors, never 500 or a hang (review focus 2)', function (array $template, string $part) {
    $started = microtime(true);

    $json = $this->postJson('/api/render', ['scenario' => 'long_invoice', 'template' => $template])->assertOk()->json();

    expect($json['errors'])->not->toBeEmpty()
        ->and($json['errors'][0]['part'])->toBe($part)
        ->and($json['errors'][0])->toHaveKeys(['file', 'line', 'message'])
        ->and(microtime(true) - $started)->toBeLessThan(10.0);
})->with([
    'syntax error' => [['body' => "<p>ok</p>\n{% for p in positions %}{{ p.title }"], 'body'],
    'unknown filter' => [['footer' => '{{ document.number | shout }}'], 'footer'],
    'endless loop' => [['body' => '{% for a in (1..100000) %}{% for b in (1..100000) %}x{% endfor %}{% endfor %}'], 'body'],
    'too large' => [['body' => str_repeat('<p>x</p>', 40000)], 'body'],
]);

it('reports the line of a syntax error', function () {
    $this->postJson('/api/render', ['scenario' => 'long_invoice', 'template' => ['body' => "<p>ok</p>\n{% for p in positions %}{{ p.title }"]])
        ->assertOk()
        ->assertJsonPath('errors.0.file', 'template.liquid')
        ->assertJsonPath('errors.0.line', 2);
});

it('previews unsaved draft changes, prefixes their validation paths and refuses them for finalized documents', function () {
    $document = draft(DocumentType::Invoice, [itemRow('Workshop', '10', '95')]);

    $this->postJson('/api/render', ['document_id' => $document->id, 'draft' => ['groups' => [['title' => null, 'positions' => [itemRow('Workshop', '2', '95')]]]]])
        ->assertOk()
        ->assertJsonPath('totals.net', '190.00')
        ->assertJsonPath('issues', []);
    $this->postJson('/api/render', ['document_id' => $document->id, 'draft' => ['groups' => [['positions' => [['kind' => 'item', 'quantity' => 'x']]]]]])
        ->assertUnprocessable()
        ->assertJsonPath('violations.0.path', 'draft.groups.0.positions.0.quantity');

    $finalized = app(FinalizeDocument::class)->handle(systemActor(), $document);
    $this->postJson('/api/render', ['document_id' => $finalized->id, 'draft' => ['intro' => 'x']])
        ->assertStatus(409)
        ->assertJsonPath('reason', 'document_locked');
});

it('lists sample scenarios and matching documents as preview sources', function () {
    $document = draft(DocumentType::Invoice, [], ['customer_id' => Customer::factory()->create(['name' => 'Kulturwerk Elbinsel e. V.'])->id]);

    $json = $this->getJson('/api/render/sources?q=elbinsel')->assertOk()->json();

    expect(collect($json['scenarios'])->pluck('key')->all())->toBe(['short_invoice', 'long_invoice', 'small_business', 'reverse_charge', 'offer_with_options'])
        ->and($json['scenarios'][4]['document_type'])->toBe('offer')
        ->and($json['documents'])->toHaveCount(1)
        ->and($json['documents'][0])->toMatchArray(['id' => $document->id, 'type' => 'invoice', 'status' => 'draft', 'customer_name' => 'Kulturwerk Elbinsel e. V.']);
    $this->getJson('/api/render/sources?limit=500')->assertUnprocessable()->assertJsonPath('violations.0.path', 'limit');
});

it('describes core and custom fields per level, filtered by document type', function () {
    FieldDefinition::factory()->create(['scope' => FieldScope::Document, 'key' => 'project_name', 'label' => 'Project', 'doc_types' => ['offer']]);
    FieldDefinition::factory()->create(['scope' => FieldScope::Position, 'key' => 'ticket', 'label' => 'Ticket', 'doc_types' => ['invoice']]);

    $all = $this->getJson('/api/render/schema')->assertOk()->json('levels');
    expect(array_keys($all))->toBe(['org', 'customer', 'contact', 'document', 'position'])
        ->and($all['org']['core'])->toContain('vat_id', 'logo')
        ->and($all['position']['context'])->toBe('positions[]')
        ->and(collect($all['document']['custom'])->pluck('key')->all())->toBe(['project_name']);

    $invoice = $this->getJson('/api/render/schema?document_type=invoice')->assertOk()->json('levels');
    expect($invoice['document']['custom'])->toBe([])
        ->and($invoice['position']['custom'][0])->toMatchArray(['key' => 'ticket', 'label' => 'Ticket', 'type' => 'text', 'required' => false, 'doc_types' => ['invoice']]);
});
