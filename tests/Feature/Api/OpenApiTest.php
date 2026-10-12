<?php

it('documents every resource, document action and file endpoint in OpenAPI', function () {
    $doc = $this->get('/api/docs.jsonopenapi')->assertOk()->json();

    expect($doc['openapi'])->toStartWith('3.')
        ->and($doc['info']['title'])->toBe('openbill API')
        ->and($doc['info']['license']['name'])->toBe('MIT')
        ->and(array_keys($doc['paths']))->toContain(
            '/api/customers', '/api/customers/{id}',
            '/api/documents', '/api/documents/{id}',
            '/api/documents/{id}/finalize', '/api/documents/{id}/status', '/api/documents/{id}/convert',
            '/api/documents/{id}/cancel', '/api/documents/{id}/duplicate',
            '/api/documents/{id}/pdf', '/api/documents/{id}/xml',
            '/api/field-definitions', '/api/tax-rates', '/api/units', '/api/text-blocks',
            '/api/templates', '/api/templates/{id}', '/api/templates/{id}/duplicate', '/api/templates/{id}/files', '/api/templates/{id}/package',
            '/api/document-types', '/api/document-types/{type}', '/api/organization',
            '/api/render', '/api/render/sources', '/api/render/schema', '/api/position-suggestions',
        )
        ->and($doc['components']['securitySchemes'] ?? [])->not->toBeEmpty()
        ->and(array_keys($doc['paths']))->not->toContain('/api/downloads/documents/{id}/{kind}');
});

it('serves Swagger UI under /api/docs', function () {
    $this->get('/api/docs', ['Accept' => 'text/html'])->assertOk()->assertSee('swagger', false);
});
