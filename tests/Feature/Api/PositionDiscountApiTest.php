<?php

use App\Enums\DocumentType;
use App\Mcp\Tools\CreateDocumentTool;
use App\Mcp\Tools\UpdateDocumentTool;
use App\Models\Customer;

it('creates and reads positions with a discount over REST, with the discounted line totals', function () {
    $this->withToken(apiToken());
    $customer = Customer::factory()->create();

    $created = $this->postJson('/api/documents', [
        'type' => 'invoice',
        'customer_id' => $customer->id,
        'groups' => [['title' => null, 'positions' => [
            itemRow('Workshop', '2', '85', ['discount_type' => 'percent', 'discount_value' => '100']),
            itemRow('Lizenz', '5', '80', ['discount_type' => 'amount', 'discount_value' => '50']),
            itemRow('Beratung', '1', '100'),
        ]]],
    ])->assertCreated();

    $id = $created->json('id');
    $positions = $created->json('groups.0.positions');
    $read = $this->getJson("/api/documents/{$id}", ['Accept' => 'application/json'])->assertOk();

    expect(array_map(fn (array $p): array => [$p['discount_type'], $p['discount_value']], $positions))->toBe([['percent', '100.00'], ['amount', '50.00'], [null, null]])
        ->and($read->json('totals.lines.'.$positions[0]['id']))->toBe(['net' => '0.00', 'before_discount' => '170.00', 'discount' => '170.00', 'tax_percent' => '19', 'tax_category' => 'S'])
        ->and($read->json('totals.lines.'.$positions[1]['id'].'.net'))->toBe('350.00')
        ->and($read->json('totals.net'))->toBe('450.00')
        ->and($read->json('gross_total'))->toBe('535.50');

    // sending the groups back as they came keeps the discount
    $this->patchJson("/api/documents/{$id}", ['groups' => $read->json('groups')])
        ->assertOk()
        ->assertJsonPath('groups.0.positions.1.discount_type', 'amount')
        ->assertJsonPath('totals.net', '450.00');
});

it('answers invalid discounts with 422 and the field path', function () {
    $this->withToken(apiToken());
    $document = draft(DocumentType::Invoice);

    $this->patchJson("/api/documents/{$document->id}", ['groups' => [['title' => null, 'positions' => [itemRow('Workshop', '1', '100', ['discount_type' => 'percent', 'discount_value' => '150'])]]]])
        ->assertStatus(422)
        ->assertJsonPath('violations.0.path', 'groups.0.positions.0.discount_value');

    $this->postJson('/api/render', ['document_id' => $document->id, 'draft' => ['groups' => [['title' => null, 'positions' => [itemRow('Workshop', '1', '100', ['discount_type' => 'amount', 'discount_value' => '-5'])]]]]])
        ->assertStatus(422)
        ->assertJsonPath('violations.0.path', 'draft.groups.0.positions.0.discount_value');
});

it('lists a discount larger than the line as an issue of the draft', function () {
    $this->withToken(apiToken());
    $document = draft(DocumentType::Invoice, [itemRow('Workshop', '1', '100', ['discount_type' => 'amount', 'discount_value' => '150'])]);
    $position = $document->groups[0]->positions[0];

    $issues = collect($this->getJson("/api/documents/{$document->id}", ['Accept' => 'application/json'])->assertOk()->json('issues'));

    expect($issues->firstWhere('code', 'discount_exceeds_line'))->toMatchArray(['path' => "positions.{$position->id}.discount"]);
});

it('takes and returns the discount over MCP like the REST API', function () {
    $customer = Customer::factory()->create();

    $draft = mcpJson(mcpTool(CreateDocumentTool::class, [
        'type' => 'invoice',
        'customer_id' => $customer->id,
        'groups' => [['title' => null, 'positions' => [itemRow('Workshop', '10', '95', ['discount_type' => 'percent', 'discount_value' => '10'])]]],
    ])->assertOk());

    expect($draft['groups'][0]['positions'][0])->toMatchArray(['discount_type' => 'percent', 'discount_value' => '10.00'])
        ->and($draft['totals']['net'])->toBe('855.00')
        ->and($draft)->toBe($this->withToken(apiToken(['api:read']))->getJson("/api/documents/{$draft['id']}")->json());

    $position = $draft['groups'][0]['positions'][0];
    $updated = mcpJson(mcpTool(UpdateDocumentTool::class, [
        'id' => $draft['id'],
        'groups' => [['id' => $draft['groups'][0]['id'], 'title' => null, 'positions' => [[...$position, 'discount_type' => 'amount', 'discount_value' => '100']]]],
    ])->assertOk());

    expect($updated['totals']['net'])->toBe('850.00');

    mcpTool(UpdateDocumentTool::class, [
        'id' => $draft['id'],
        'groups' => [['title' => null, 'positions' => [[...$position, 'discount_type' => 'percent', 'discount_value' => '100.5']]]],
    ])->assertHasErrors(['- groups.0.positions.0.discount_value: ']);
});

it('describes the discount in the input schema of the document tools', function () {
    $schema = mcpRpc(apiToken(['mcp']), 'tools/list')['result']['tools'];
    $create = collect($schema)->firstWhere('name', 'create-document');
    $position = $create['inputSchema']['properties']['groups']['items']['properties']['positions']['items']['properties'];

    expect($position['discount_type'])->toMatchArray(['type' => ['string', 'null'], 'enum' => ['percent', 'amount', null]])
        ->and($position['discount_value']['type'])->toBe(['string', 'null'])
        ->and($position['discount_value']['description'])->toContain('percent');
});
