<?php

namespace App\OpenApi;

use ApiPlatform\OpenApi\Factory\OpenApiFactoryInterface;
use ApiPlatform\OpenApi\Model\Operation;
use ApiPlatform\OpenApi\Model\Parameter;
use ApiPlatform\OpenApi\Model\PathItem;
use ApiPlatform\OpenApi\Model\RequestBody;
use ApiPlatform\OpenApi\Model\Response;
use ApiPlatform\OpenApi\OpenApi;
use ArrayObject;

/**
 * Adds the routes of routes/api.php (files and action results API Platform does not serialize) to the
 * OpenAPI document served under /api/docs. Registered in AppServiceProvider. Signed download links are
 * internal (MCP) and not listed.
 */
final class OpenApiFactory implements OpenApiFactoryInterface
{
    private const PROBLEM = ['type' => 'object', 'properties' => [
        'type' => ['type' => 'string'], 'title' => ['type' => 'string'], 'status' => ['type' => 'integer'],
        'detail' => ['type' => 'string'], 'reason' => ['type' => 'string'],
    ]];

    private const RENDER_INPUT = ['type' => 'object', 'properties' => [
        'template_id' => ['type' => 'string'],
        'template' => ['type' => 'object', 'description' => 'unsaved parts: header, body, footer, css, manifest'],
        'document_id' => ['type' => 'string', 'description' => 'required without scenario'],
        'draft' => ['type' => 'object', 'description' => 'unsaved draft changes (PATCH /api/documents/{id} body)'],
        'scenario' => ['type' => 'string', 'enum' => ['short_invoice', 'long_invoice', 'small_business', 'reverse_charge', 'offer_with_options']],
        'locale' => ['type' => 'string', 'enum' => ['en', 'de']],
    ]];

    private const RENDER_OUTPUT = ['type' => 'object', 'properties' => [
        'header' => ['type' => 'string'], 'body' => ['type' => 'string'], 'footer' => ['type' => 'string'],
        'paper' => ['type' => 'object'],
        'errors' => ['type' => 'array', 'items' => ['type' => 'object', 'properties' => [
            'part' => ['type' => 'string'], 'file' => ['type' => 'string', 'nullable' => true],
            'line' => ['type' => 'integer', 'nullable' => true], 'message' => ['type' => 'string'],
        ]]],
        'totals' => ['type' => 'object'],
        'issues' => ['type' => 'array', 'items' => ['type' => 'object']],
    ]];

    public function __construct(private readonly OpenApiFactoryInterface $decorated) {}

    /**
     * @param  array<string, mixed>  $context
     */
    public function __invoke(array $context = []): OpenApi
    {
        $openApi = ($this->decorated)($context);
        foreach (self::paths() as $path => $item) {
            $openApi->getPaths()->addPath($path, $item);
        }

        return $openApi;
    }

    /**
     * @return array<string, PathItem>
     */
    private static function paths(): array
    {
        $id = new Parameter('id', 'path', 'ULID', true, schema: ['type' => 'string']);
        $query = fn (string $name, string $text, string $type = 'string'): Parameter => new Parameter($name, 'query', $text, false, schema: ['type' => $type]);

        return [
            '/api/documents/{id}/pdf' => new PathItem(get: new Operation(
                operationId: 'getDocumentPdf',
                tags: ['Document'],
                responses: self::responses(self::file('application/pdf', 'Finalized: the archived PDF. Draft: rendered live with a watermark.')),
                summary: 'Downloads the PDF of a document.',
                parameters: [$id, $query('inline', '1 = inline instead of attachment', 'boolean')],
            )),
            '/api/documents/{id}/xml' => new PathItem(get: new Operation(
                operationId: 'getDocumentXml',
                tags: ['Document'],
                responses: self::responses(self::file('application/xml', 'The archived EN 16931 XML (409 no_e_invoice otherwise).')),
                summary: 'Downloads the e-invoice XML of a finalized document.',
                parameters: [$id],
            )),
            '/api/templates/{id}/package' => new PathItem(get: new Operation(
                operationId: 'getTemplatePackage',
                tags: ['Template'],
                responses: self::responses(self::file('application/zip', 'Template package: manifest.json, template.liquid, header.liquid, footer.liquid, styles.css, assets/.')),
                summary: 'Downloads a template as package ZIP.',
                parameters: [$id],
            )),
            '/api/uploads' => new PathItem(post: new Operation(
                operationId: 'uploadImage',
                tags: ['Upload'],
                responses: self::responses(self::json('Stored image: path (the value of an image field), mime, size.')),
                summary: 'Uploads an image (PNG, JPEG, GIF, WebP, SVG, at most 1 MB) for an image field.',
                requestBody: new RequestBody('Multipart form with the field "file"', new ArrayObject(['multipart/form-data' => ['schema' => [
                    'type' => 'object', 'properties' => ['file' => ['type' => 'string', 'format' => 'binary']], 'required' => ['file'],
                ]]]), true),
            )),
            '/api/uploads/{name}' => new PathItem(get: new Operation(
                operationId: 'getUpload',
                tags: ['Upload'],
                responses: self::responses(self::file('image/*', 'The stored image (sandboxed).')),
                summary: 'Downloads an uploaded image.',
                parameters: [new Parameter('name', 'path', '<ulid>.<ext> from the upload path', true, schema: ['type' => 'string'])],
            )),
            '/api/field-definitions/reorder' => new PathItem(post: new Operation(
                operationId: 'reorderFieldDefinitions',
                tags: ['FieldDefinition'],
                responses: self::responses(new Response('Order stored')),
                summary: 'Sets the order of all custom fields of one level.',
                requestBody: new RequestBody('scope and every field id of that level', new ArrayObject(['application/json' => ['schema' => [
                    'type' => 'object',
                    'properties' => ['scope' => ['type' => 'string'], 'ids' => ['type' => 'array', 'items' => ['type' => 'string']]],
                    'required' => ['scope', 'ids'],
                ]]]), true),
            )),
            '/api/organization/logo' => new PathItem(
                get: new Operation(
                    operationId: 'getOrganizationLogo',
                    tags: ['Organization'],
                    responses: self::responses(self::file('image/*', 'The current logo (404 without one).')),
                    summary: 'Downloads the logo of the organization.',
                ),
                post: new Operation(
                    operationId: 'uploadOrganizationLogo',
                    tags: ['Organization'],
                    responses: self::responses(self::json('has_logo and updated_at.')),
                    summary: 'Replaces the logo (PNG, JPEG, GIF, WebP, SVG, at most 1 MB).',
                    requestBody: new RequestBody('Multipart form with the field "logo"', new ArrayObject(['multipart/form-data' => ['schema' => [
                        'type' => 'object', 'properties' => ['logo' => ['type' => 'string', 'format' => 'binary']], 'required' => ['logo'],
                    ]]]), true),
                ),
                delete: new Operation(
                    operationId: 'removeOrganizationLogo',
                    tags: ['Organization'],
                    responses: self::responses(new Response('Logo removed')),
                    summary: 'Removes the logo; templates show the company name again.',
                ),
            ),
            '/api/render' => new PathItem(post: new Operation(
                operationId: 'render',
                tags: ['Render'],
                responses: self::responses(self::json('Rendered parts, paper, template errors (still 200), totals and compliance issues.', self::RENDER_OUTPUT)),
                summary: 'Renders a preview of a document or a sample scenario, optionally with unsaved template parts or draft changes.',
                requestBody: new RequestBody('Preview input', new ArrayObject(['application/json' => ['schema' => self::RENDER_INPUT]]), true),
            )),
            '/api/render/sources' => new PathItem(get: new Operation(
                operationId: 'getRenderSources',
                tags: ['Render'],
                responses: self::responses(self::json('Sample scenarios and recent documents.')),
                summary: 'Lists what a preview can render.',
                parameters: [$query('q', 'number or customer name contains'), $query('limit', '1–100, default 20', 'integer')],
            )),
            '/api/render/schema' => new PathItem(get: new Operation(
                operationId: 'getRenderSchema',
                tags: ['Render'],
                responses: self::responses(self::json('Core and custom fields per level (org, customer, contact, document, position).')),
                summary: 'Describes the fields templates can use.',
                parameters: [$query('document_type', 'offer, confirmation, invoice or cancellation')],
            )),
            '/api/position-suggestions' => new PathItem(get: new Operation(
                operationId: 'getPositionSuggestions',
                tags: ['Document'],
                responses: self::responses(self::json('Earlier positions, most used first.', ['type' => 'array', 'items' => ['type' => 'object']])),
                summary: 'Suggests positions from earlier documents.',
                parameters: [$query('q', 'title contains'), $query('limit', '1–50, default 20', 'integer')],
            )),
        ];
    }

    private static function file(string $mime, string $text): Response
    {
        return new Response($text, new ArrayObject([$mime => ['schema' => ['type' => 'string', 'format' => 'binary']]]));
    }

    /**
     * @param  array<string, mixed>  $schema
     */
    private static function json(string $text, array $schema = ['type' => 'object']): Response
    {
        return new Response($text, new ArrayObject(['application/json' => ['schema' => $schema]]));
    }

    /**
     * @return array<int, Response>
     */
    private static function responses(Response $ok): array
    {
        $problem = fn (string $text): Response => new Response($text, new ArrayObject(['application/problem+json' => ['schema' => self::PROBLEM]]));

        return [
            '200' => $ok,
            '401' => $problem('Not authenticated'),
            '403' => $problem('The token lacks the ability'),
            '404' => $problem('Not found'),
            '409' => $problem('Not possible in the current state'),
            '422' => $problem('Invalid input (violations)'),
        ];
    }
}
