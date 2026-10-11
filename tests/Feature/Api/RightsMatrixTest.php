<?php

use App\Actions\RevokeApiToken;
use App\Enums\DocumentType;
use App\Models\Customer;
use App\Models\PersonalAccessToken;
use App\Models\Template;

/*
 * Review focus 5: every endpoint × every kind of token. "allowed" means: neither 401 nor 403 (the request
 * itself may still be invalid, e.g. 422 for an empty body); everything else must be 401 (no token) or 403.
 */

const MATRIX_TOKENS = ['none', 'api:read', 'api:write', 'mcp', 'templates:render', 'templates:write(A)'];

const MATRIX_READ = ['api:read', 'api:write'];

const MATRIX_OWN_TEMPLATE_READ = ['api:read', 'api:write', 'templates:write(A)'];

beforeEach(function () {
    $this->templateA = Template::factory()->create();
    $this->templateB = Template::factory()->create();
    $this->draft = draft();
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
    $uri = strtr($path, ['{draft}' => $this->draft->id, '{A}' => $this->templateA->id, '{B}' => $this->templateB->id]);
    $plain = matrixToken($token, $this->templateA);
    $client = $plain === null ? $this : $this->withToken($plain);

    $response = $client->json($method, $uri);

    if ($token === 'none') {
        $response->assertUnauthorized()->assertHeader('Content-Type', 'application/problem+json');
    } elseif (in_array($token, $allowed, true)) {
        expect($response->getStatusCode())->not->toBeIn([401, 403], "{$method} {$uri} with {$token}: {$response->getContent()}");
    } else {
        $response->assertForbidden()->assertHeader('Content-Type', 'application/problem+json');
    }
})->with([
    'list customers' => ['GET', '/api/customers', MATRIX_READ],
    'create customer' => ['POST', '/api/customers', ['api:write']],
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
    'tax rates' => ['GET', '/api/tax-rates', MATRIX_READ],
    'units' => ['GET', '/api/units', MATRIX_READ],
    'text blocks' => ['GET', '/api/text-blocks', MATRIX_READ],
    'document types' => ['GET', '/api/document-types', MATRIX_READ],
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
    'write own template' => ['PUT', '/api/templates/{A}/files', ['api:write', 'templates:write(A)']],
    'other template' => ['GET', '/api/templates/{B}', MATRIX_READ],
    'other package' => ['GET', '/api/templates/{B}/package', MATRIX_READ],
    'write other template' => ['PUT', '/api/templates/{B}/files', ['api:write']],
    'delete template' => ['DELETE', '/api/templates/{B}', ['api:write']],
])->with(MATRIX_TOKENS);

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
