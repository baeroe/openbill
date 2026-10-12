<?php

namespace App\Mcp\Tools;

use App\ApiResource\TemplateResource;
use App\Mcp\Output;
use App\Models\Template;
use App\Support\Actor;
use Illuminate\Contracts\JsonSchema\JsonSchema;
use Laravel\Mcp\Request;
use Laravel\Mcp\Response;
use Laravel\Mcp\Server\Attributes\Description;
use Laravel\Mcp\Server\Attributes\Name;
use Laravel\Mcp\Server\Tools\Annotations\IsReadOnly;

#[Name('get-template')]
#[Description('One template with all parts: header, body, footer (Liquid), css, manifest and the list of assets (paths only). Read the resource openbill://docs/liquid-reference before changing Liquid.')]
#[IsReadOnly]
final class GetTemplateTool extends OpenbillTool
{
    protected function run(Request $request, Actor $actor): Response
    {
        $template = self::find($request, Template::class, 'template');

        return Output::json(Output::resource(TemplateResource::fromModel($template)));
    }

    /**
     * @return array<string, mixed>
     */
    public function schema(JsonSchema $schema): array
    {
        return ['id' => $schema->string()->required()->description('Template ID (ULID)')];
    }
}
