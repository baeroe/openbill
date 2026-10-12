<?php

use App\Enums\FieldScope;
use App\Enums\FieldType;
use App\Mcp\Tools\CreateCustomerTool;
use App\Mcp\Tools\GetCustomerTool;
use App\Mcp\Tools\ListCustomersTool;
use App\Mcp\Tools\UpdateCustomerTool;
use App\Models\Customer;
use App\Models\FieldDefinition;

it('lists customers by name, searches and pages, each item like GET /api/customers/{id}', function () {
    Customer::factory()->create(['name' => 'Hafenkontor Lindqvist GmbH']);
    $fjord = Customer::factory()->create(['name' => 'Fjord Analytics AB']);

    $first = mcpJson(mcpTool(ListCustomersTool::class, ['per_page' => 1])->assertOk()->assertName('list-customers'));
    $found = mcpJson(mcpTool(ListCustomersTool::class, ['q' => 'fjord'])->assertOk());

    expect($first)->toMatchArray(['page' => 1, 'per_page' => 1, 'total' => 2, 'has_more' => true])
        ->and($first['items'][0]['name'])->toBe('Fjord Analytics AB')
        ->and($found['items'])->toHaveCount(1)
        ->and($found['items'][0])->toBe($this->withToken(apiToken(['api:read']))->getJson("/api/customers/{$fjord->id}")->assertOk()->json());
});

it('reads one customer and names an unknown or missing id', function () {
    $customer = Customer::factory()->create(['name' => 'Hotel Alpenglück GmbH']);

    mcpTool(GetCustomerTool::class, ['id' => $customer->id])->assertOk()->assertSee('Hotel Alpenglück GmbH');
    mcpTool(GetCustomerTool::class, ['id' => '01jaaaaaaaaaaaaaaaaaaaaaaa'])
        ->assertHasErrors(['There is no customer with the ID 01jaaaaaaaaaaaaaaaaaaaaaaa.']);
    mcpTool(GetCustomerTool::class)->assertHasErrors(["Invalid input:\n- id: "]);
});

it('creates a customer with contacts and answers like the REST API', function () {
    $created = mcpJson(mcpTool(CreateCustomerTool::class, [
        'name' => 'Hafenkontor Lindqvist GmbH', 'street' => 'Kaistraße 4', 'zip' => '20457', 'city' => 'Hamburg', 'country' => 'de',
        'contacts' => [['first_name' => 'Mira', 'last_name' => 'Lindqvist', 'email' => 'mira@hafenkontor.example']],
    ])->assertOk());

    expect($created)->toMatchArray(['number' => 'C-1001', 'country' => 'DE', 'tax_treatment' => 'domestic', 'customer_kind' => 'business'])
        ->and($created['contacts'][0]['is_default'])->toBeTrue()
        ->and($created)->toBe($this->withToken(apiToken(['api:read']))->getJson("/api/customers/{$created['id']}")->json());
});

it('refuses invalid input with field paths and saves nothing', function (array $input, string $path) {
    FieldDefinition::factory()->create(['scope' => FieldScope::Customer, 'key' => 'segment', 'label' => 'Segment', 'type' => FieldType::Select, 'options' => ['retail', 'wholesale']]);

    mcpTool(CreateCustomerTool::class, ['name' => 'Kulturwerk Elbinsel', ...$input])->assertHasErrors(["- {$path}: "]);

    expect(Customer::query()->count())->toBe(0);
})->with([
    'unknown option' => [['custom' => ['segment' => 'export']], 'custom.segment'],
    'unknown field' => [['custom' => ['colour' => 'red']], 'custom.colour'],
    'invalid email' => [['email' => 'not-an-email'], 'email'],
    'private person with reverse charge' => [['tax_treatment' => 'eu_reverse_charge', 'customer_kind' => 'consumer'], 'customer_kind'],
    'empty name' => [['name' => ''], 'name'],
]);

it('changes only the sent keys and keeps the contacts', function () {
    $customer = mcpJson(mcpTool(CreateCustomerTool::class, ['name' => 'Fjord Analytics AB', 'contacts' => [['first_name' => 'Ingrid', 'last_name' => 'Dahl']]])->assertOk());

    $updated = mcpJson(mcpTool(UpdateCustomerTool::class, ['id' => $customer['id'], 'city' => 'Bergen', 'country' => 'NO', 'tax_treatment' => 'third_country'])->assertOk());

    expect($updated)->toMatchArray(['name' => 'Fjord Analytics AB', 'city' => 'Bergen', 'country' => 'NO', 'tax_treatment' => 'third_country'])
        ->and($updated['contacts'][0]['id'])->toBe($customer['contacts'][0]['id']);
    mcpTool(UpdateCustomerTool::class, ['id' => '01jaaaaaaaaaaaaaaaaaaaaaaa', 'city' => 'Oslo'])->assertHasErrors(['There is no customer']);
});
