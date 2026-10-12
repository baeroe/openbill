<?php

use App\Actions\RevokeApiToken;
use App\Enums\DocumentType;
use App\Models\Customer;
use App\Models\FieldDefinition;
use App\Models\PersonalAccessToken;
use App\Models\TaxRate;
use App\Models\Template;
use App\Models\TextBlock;
use App\Models\Unit;
use Illuminate\Routing\Route as RoutingRoute;
use Illuminate\Support\Facades\Route;

/*
 * Review focus 5: every endpoint × every kind of token. "allowed" means: neither 401 nor 403 nor a server
 * error (the request itself may still be invalid, e.g. 422 for an empty body); everything else must be
 * 401 (no token) or 403. MATRIX_ROUTES lists every endpoint; a guard test keeps it in sync with the routes.
 */

const MATRIX_TOKENS = ['none', 'api:read', 'api:write', 'mcp', 'templates:render', 'templates:write(A)'];

const MATRIX_READ = ['api:read', 'api:write'];

const MATRIX_OWN_TEMPLATE_READ = ['api:read', 'api:write', 'templates:write(A)'];

const MATRIX_ROUTES = [
    'list customers' => ['GET', '/api/customers', MATRIX_READ],
    'create customer' => ['POST', '/api/customers', ['api:write']],
    'show customer' => ['GET', '/api/customers/{customer}', MATRIX_READ],
    'change customer' => ['PATCH', '/api/customers/{customer}', ['api:write']],
    'delete customer' => ['DELETE', '/api/customers/{customer}', ['api:write']],
    'list documents' => ['GET', '/api/documents', MATRIX_READ],
    'show document' => ['GET', '/api/documents/{draft}', MATRIX_READ],
    'create document' => ['POST', '/api/documents', ['api:write']],
    'save draft' => ['PATCH', '/api/documents/{draft}', ['api:write']],
    'finalize' => ['POST', '/api/documents/{draft}/finalize', ['api:write']],
    'set status' => ['POST', '/api/documents/{draft}/status', ['api:write']],
    'convert' => ['POST', '/api/documents/{draft}/convert', ['api:write']],
    'cancel' => ['POST', '/api/documents/{draft}/cancel', ['api:write']],
    'duplicate' => ['POST', '/api/documents/{draft}/duplicate', ['api:write']],
    'delete draft' => ['DELETE', '/api/documents/{draft}', ['api:write']],
    'pdf' => ['GET', '/api/documents/{draft}/pdf', MATRIX_READ],
    'xml' => ['GET', '/api/documents/{draft}/xml', MATRIX_READ],
    'position suggestions' => ['GET', '/api/position-suggestions', MATRIX_READ],
    'field definitions' => ['GET', '/api/field-definitions', MATRIX_READ],
    'create field' => ['POST', '/api/field-definitions', ['api:write']],
    'show field' => ['GET', '/api/field-definitions/{field}', MATRIX_READ],
    'change field' => ['PATCH', '/api/field-definitions/{field}', ['api:write']],
    'delete field' => ['DELETE', '/api/field-definitions/{field}', ['api:write']],
    'tax rates' => ['GET', '/api/tax-rates', MATRIX_READ],
    'create tax rate' => ['POST', '/api/tax-rates', ['api:write']],
    'show tax rate' => ['GET', '/api/tax-rates/{rate}', MATRIX_READ],
    'change tax rate' => ['PATCH', '/api/tax-rates/{rate}', ['api:write']],
    'archive tax rate' => ['DELETE', '/api/tax-rates/{rate}', ['api:write']],
    'units' => ['GET', '/api/units', MATRIX_READ],
    'create unit' => ['POST', '/api/units', ['api:write']],
    'show unit' => ['GET', '/api/units/{unit}', MATRIX_READ],
    'change unit' => ['PATCH', '/api/units/{unit}', ['api:write']],
    'archive unit' => ['DELETE', '/api/units/{unit}', ['api:write']],
    'text blocks' => ['GET', '/api/text-blocks', MATRIX_READ],
    'create text block' => ['POST', '/api/text-blocks', ['api:write']],
    'show text block' => ['GET', '/api/text-blocks/{block}', MATRIX_READ],
    'change text block' => ['PATCH', '/api/text-blocks/{block}', ['api:write']],
    'delete text block' => ['DELETE', '/api/text-blocks/{block}', ['api:write']],
    'document types' => ['GET', '/api/document-types', MATRIX_READ],
    'show document type' => ['GET', '/api/document-types/invoice', MATRIX_READ],
    'change document type' => ['PATCH', '/api/document-types/invoice', ['api:write']],
    'organization' => ['GET', '/api/organization', MATRIX_READ],
    'change organization' => ['PATCH', '/api/organization', ['api:write']],
    'render' => ['POST', '/api/render', ['api:read', 'api:write', 'templates:render']],
    'render sources' => ['GET', '/api/render/sources', ['api:read', 'api:write', 'templates:render']],
    'render schema' => ['GET', '/api/render/schema', ['api:read', 'api:write', 'templates:render']],
    'list templates' => ['GET', '/api/templates', MATRIX_READ],
    'import template' => ['POST', '/api/templates', ['api:write']],
    'own template' => ['GET', '/api/templates/{A}', MATRIX_OWN_TEMPLATE_READ],
    'own package' => ['GET', '/api/templates/{A}/package', MATRIX_OWN_TEMPLATE_READ],
    'upload image' => ['POST', '/api/uploads', ['api:write']],
    'read upload' => ['GET', '/api/uploads/01k9x2m3n4p5q6r7s8t9v0w1y2.png', MATRIX_READ],
    'reorder fields' => ['POST', '/api/field-definitions/reorder', ['api:write']],
    'organization logo' => ['GET', '/api/organization/logo', MATRIX_READ],
    'upload organization logo' => ['POST', '/api/organization/logo', ['api:write']],
    'remove organization logo' => ['DELETE', '/api/organization/logo', ['api:write']],
    'number preview' => ['GET', '/api/document-types/invoice/number-preview', MATRIX_READ],
    'restore tax rate' => ['POST', '/api/tax-rates/{rate}/restore', ['api:write']],
    'restore unit' => ['POST', '/api/units/{unit}/restore', ['api:write']],
    'list users' => ['GET', '/api/users', []],
    'change user' => ['PATCH', '/api/users/{customer}', []],
    'disable user' => ['POST', '/api/users/{customer}/disable', []],
    'enable user' => ['POST', '/api/users/{customer}/enable', []],
    'invite user' => ['POST', '/api/invitations', []],
    'revoke invitation' => ['DELETE', '/api/invitations/{customer}', []],
    'list tokens' => ['GET', '/api/tokens', []],
    'create token' => ['POST', '/api/tokens', []],
    'revoke token' => ['DELETE', '/api/tokens/{customer}', []],
    'write own template' => ['PUT', '/api/templates/{A}/files', ['api:write', 'templates:write(A)']],
    'duplicate own template' => ['POST', '/api/templates/{A}/duplicate', ['api:write']],
    'delete own template' => ['DELETE', '/api/templates/{A}', ['api:write']],
    'other template' => ['GET', '/api/templates/{B}', MATRIX_READ],
    'other package' => ['GET', '/api/templates/{B}/package', MATRIX_READ],
    'write other template' => ['PUT', '/api/templates/{B}/files', ['api:write']],
    'delete template' => ['DELETE', '/api/templates/{B}', ['api:write']],
];

beforeEach(function () {
    $this->templateA = Template::factory()->create();
    $this->templateB = Template::factory()->create();
    $this->draft = draft();
    $this->customer = Customer::factory()->create();
    $this->field = FieldDefinition::factory()->create();
    $this->block = TextBlock::factory()->create();
    $this->rate = TaxRate::query()->firstOrFail();
    $this->unit = Unit::query()->firstOrFail();
});

function matrixToken(string $name, Template $own): ?string
{
    return match ($name) {
        'none' => null,
        'templates:write(A)' => apiToken(['templates:write'], $own->id),
        default => apiToken([$name]),
    };
}

it('opens each endpoint only to the right abilities', function (string $method, string $path, array $allowed, string $token) {
    $uri = strtr($path, [
        '{draft}' => $this->draft->id, '{A}' => $this->templateA->id, '{B}' => $this->templateB->id,
        '{customer}' => $this->customer->id, '{field}' => $this->field->id, '{block}' => $this->block->id,
        '{rate}' => $this->rate->id, '{unit}' => $this->unit->id,
    ]);
    $plain = matrixToken($token, $this->templateA);
    $client = $plain === null ? $this : $this->withToken($plain);

    $response = $client->json($method, $uri);

    if ($token === 'none') {
        $response->assertUnauthorized()->assertHeader('Content-Type', 'application/problem+json');
    } elseif (in_array($token, $allowed, true)) {
        expect($response->getStatusCode())->not->toBeIn([401, 403], "{$method} {$uri} with {$token}: {$response->getContent()}")
            ->and($response->getStatusCode())->toBeLessThan(500, "{$method} {$uri} with {$token}: {$response->getContent()}");
    } else {
        $response->assertForbidden()->assertHeader('Content-Type', 'application/problem+json');
    }
})->with(MATRIX_ROUTES)->with(MATRIX_TOKENS);

it('shuts a revoked token out of every endpoint', function () {
    $token = apiToken(['api:read', 'api:write']);
    $this->withToken($token)->getJson('/api/documents')->assertOk();

    app(RevokeApiToken::class)->handle(systemActor(), PersonalAccessToken::findToken($token));
    forgetApiAuth();

    $this->withToken($token)->getJson('/api/documents')->assertUnauthorized();
    $this->withToken($token)->postJson("/api/documents/{$this->draft->id}/finalize")->assertUnauthorized();
});

it('serves the API documentation without a token', function () {
    $this->get('/api/docs.jsonopenapi')->assertOk();
});

it('lets templates:render read every document in rendered form and list documents with customer names (spec 7, documented)', function () {
    $customer = Customer::factory()->create(['name' => 'Fjord Analytics AB']);
    $document = draft(DocumentType::Invoice, [itemRow('Workshop', '10', '95')], ['customer_id' => $customer->id]);
    $this->withToken(apiToken(['templates:render']));

    $this->postJson('/api/render', ['document_id' => $document->id])
        ->assertOk()
        ->assertJsonPath('body', fn (string $body): bool => str_contains($body, 'Fjord Analytics AB') && str_contains($body, 'Workshop'));
    $this->getJson('/api/render/sources')
        ->assertOk()
        ->assertJsonPath('documents.0.customer_name', 'Fjord Analytics AB');
    // reading the document as a resource stays closed
    $this->getJson("/api/documents/{$document->id}")->assertForbidden();
});

it('has a matrix row for every API route (new routes need one)', function () {
    // metadata routes of API Platform hold no data; signed downloads are protected by their signature
    $open = ['api/{index?}{_format?}', 'api/contexts/{shortName?}{_format?}', 'api/.well-known/genid/{id}', 'api/errors/{status}{_format?}',
        'api/validation_errors/{id}', 'api/docs{_format?}', 'api/downloads/documents/{id}/{kind}'];
    $placeholders = '/\\{(draft|A|B|customer|field|block|rate|unit)\\}/';
    $covered = collect(MATRIX_ROUTES)
        ->map(fn (array $row): string => $row[0].' '.preg_replace($placeholders, '{id}', preg_replace('#/uploads/[^/]+$#', '/uploads/{name}', str_replace('/document-types/invoice', '/document-types/{type}', ltrim($row[1], '/')))))
        ->unique()->sort()->values()->all();

    $routes = collect(Route::getRoutes()->getRoutes())
        ->filter(fn (RoutingRoute $route): bool => str_starts_with($route->uri(), 'api') && ! in_array($route->uri(), $open, true))
        ->flatMap(fn (RoutingRoute $route): array => array_map(fn (string $m): string => "{$m} {$route->uri()}", array_diff($route->methods(), ['HEAD'])))
        ->unique()->sort()->values()->all();

    expect($covered)->toBe($routes);
});

it('serves the API documentation to every kind of token', function (string $token) {
    $plain = matrixToken($token, $this->templateA);
    $client = $plain === null ? $this : $this->withToken($plain);

    $client->get('/api/docs.jsonopenapi')->assertOk();
})->with(MATRIX_TOKENS);
