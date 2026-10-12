<?php

namespace App\Mcp\Tools;

use App\Actions\UpdateTemplateFiles;
use App\ApiResource\TemplateResource;
use App\Mcp\Output;
use App\Mcp\Schemas;
use App\Models\Template;
use App\Support\Actor;
use Illuminate\Contracts\JsonSchema\JsonSchema;
use Laravel\Mcp\Request;
use Laravel\Mcp\Response;
use Laravel\Mcp\Server\Attributes\Description;
use Laravel\Mcp\Server\Attributes\Name;
use Laravel\Mcp\Server\Attributes\Title;
use Laravel\Mcp\Server\Tools\Annotations\IsDestructive;
use Laravel\Mcp\Server\Tools\Annotations\IsIdempotent;
use Laravel\Mcp\Server\Tools\Annotations\IsOpenWorld;

#[Name('update-template')]
#[Title('Update template')]
#[Description('Replace parts of an own template: header, body, footer, css and/or manifest (the parts you leave out stay; assets are not changed here). Built-in templates (built_in true) are read-only – duplicate one in the openbill UI first. Try changes with render-template-preview before saving; the answer is the template summary.')]
#[IsDestructive]
#[IsIdempotent]
#[IsOpenWorld(false)]
final class UpdateTemplateTool extends OpenbillTool
{
    public function __construct(private readonly UpdateTemplateFiles $files) {}

    protected function run(Request $request, Actor $actor): Response
    {
        $template = self::find($request, Template::class, 'template');
        $template = $this->files->handle($actor, $template, $request->all(['header', 'body', 'footer', 'css', 'manifest']));

        return Output::json(Output::resource(TemplateResource::fromModel($template), TemplateResource::LIST));
    }

    /**
     * @return array<string, mixed>
     */
    public function schema(JsonSchema $schema): array
    {
        return [
            'id' => $schema->string()->required()->description('Template ID (ULID)'),
            ...Schemas::templateParts($schema),
        ];
    }
}
