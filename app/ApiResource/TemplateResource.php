<?php

namespace App\ApiResource;

use ApiPlatform\Metadata\ApiProperty;
use ApiPlatform\Metadata\ApiResource;
use ApiPlatform\Metadata\Delete;
use ApiPlatform\Metadata\Get;
use ApiPlatform\Metadata\GetCollection;
use ApiPlatform\Metadata\Post;
use ApiPlatform\Metadata\Put;
use ApiPlatform\OpenApi\Model\Operation as OpenApiOperation;
use ApiPlatform\OpenApi\Model\RequestBody;
use App\ApiResource\Input\TemplateFilesInput;
use App\Http\Api\ApiMiddleware;
use App\Models\Template;
use App\Models\TemplateAsset;
use App\State\Processor\TemplateProcessor;
use App\State\Provider\TemplateProvider;
use ArrayObject;
use Symfony\Component\Serializer\Attribute\Groups;

/** Liquid template (header, body, footer, styles, manifest, assets). Built-in templates are read-only. */
#[ApiResource(
    shortName: 'Template',
    normalizationContext: ['groups' => [self::ITEM], 'preserve_empty_objects' => true, 'skip_null_values' => false],
    operations: [
        new GetCollection(
            uriTemplate: '/templates',
            paginationEnabled: false,
            middleware: ApiMiddleware::READ,
            provider: TemplateProvider::class,
            normalizationContext: ['groups' => [self::LIST], 'preserve_empty_objects' => true, 'skip_null_values' => false],
        ),
        new Get(uriTemplate: '/templates/{id}', middleware: ApiMiddleware::TEMPLATE_READ, provider: TemplateProvider::class),
        new Post(
            uriTemplate: '/templates',
            inputFormats: ['multipart' => ['multipart/form-data']],
            middleware: ApiMiddleware::WRITE,
            read: false,
            deserialize: false,
            processor: TemplateProcessor::class,
            openapi: new OpenApiOperation(
                summary: 'Imports a template package (ZIP, field "package").',
                requestBody: new RequestBody(
                    content: new ArrayObject(['multipart/form-data' => ['schema' => [
                        'type' => 'object',
                        'properties' => ['package' => ['type' => 'string', 'format' => 'binary']],
                        'required' => ['package'],
                    ]]]),
                    required: true,
                ),
            ),
        ),
        new Put(
            uriTemplate: '/templates/{id}/files',
            name: 'template_files',
            status: 200,
            input: TemplateFilesInput::class,
            middleware: ApiMiddleware::TEMPLATE_WRITE,
            read: false,
            deserialize: false,
            processor: TemplateProcessor::class,
            description: 'Replaces the given files: header, body, footer, css, manifest and the complete assets list (base64).',
        ),
        new Delete(uriTemplate: '/templates/{id}', middleware: ApiMiddleware::WRITE, read: false, processor: TemplateProcessor::class),
    ],
)]
final class TemplateResource
{
    public const LIST = 'template:list';

    public const ITEM = 'template:item';

    /**
     * @param  ArrayObject<string, mixed>  $manifest
     * @param  list<array{path: string, mime: string, size: int}>  $assets
     */
    public function __construct(
        #[ApiProperty(identifier: true, writable: false)]
        #[Groups([self::LIST, self::ITEM])]
        public string $id,
        #[Groups([self::LIST, self::ITEM])]
        public string $name,
        #[Groups([self::LIST, self::ITEM])]
        public string $slug,
        #[Groups([self::LIST, self::ITEM])]
        public string $version,
        #[Groups([self::LIST, self::ITEM])]
        public string $author,
        #[Groups([self::LIST, self::ITEM])]
        public string $license,
        #[Groups([self::LIST, self::ITEM])]
        public ?string $description,
        #[Groups([self::LIST, self::ITEM])]
        public bool $built_in,
        #[Groups([self::ITEM])]
        public ArrayObject $manifest,
        #[Groups([self::ITEM])]
        public string $header,
        #[Groups([self::ITEM])]
        public string $body,
        #[Groups([self::ITEM])]
        public string $footer,
        #[Groups([self::ITEM])]
        public string $css,
        #[Groups([self::ITEM])]
        public array $assets,
        #[Groups([self::LIST, self::ITEM])]
        public ?string $updated_at,
    ) {}

    public static function fromModel(Template $template): self
    {
        $template->loadMissing('assets');

        return new self(
            id: $template->id,
            name: $template->name,
            slug: $template->slug,
            version: $template->version,
            author: (string) $template->author,
            license: (string) $template->license,
            description: $template->description,
            built_in: $template->built_in,
            manifest: new ArrayObject($template->manifest ?? []),
            header: (string) $template->header,
            body: (string) $template->body,
            footer: (string) $template->footer,
            css: (string) $template->css,
            assets: $template->assets->sortBy('path')->map(fn (TemplateAsset $asset): array => [
                'path' => $asset->path,
                'mime' => $asset->mime,
                'size' => $asset->size,
            ])->values()->all(),
            updated_at: $template->updated_at?->toAtomString(),
        );
    }
}
