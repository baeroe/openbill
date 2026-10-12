<?php

namespace App\Mcp\Tools;

use App\ApiResource\TemplateResource;
use App\Mcp\Output;
use App\State\Provider\TemplateProvider;
use App\Support\Actor;
use Laravel\Mcp\Request;
use Laravel\Mcp\Response;
use Laravel\Mcp\Server\Attributes\Description;
use Laravel\Mcp\Server\Attributes\Name;
use Laravel\Mcp\Server\Attributes\Title;
use Laravel\Mcp\Server\Tools\Annotations\IsOpenWorld;
use Laravel\Mcp\Server\Tools\Annotations\IsReadOnly;

#[Name('list-templates')]
#[Title('List templates')]
#[Description('Templates without their sources: name, slug, version, built_in (read-only: Klar, Kante, Leise) and the document types they support. Templates in use come first. get-template returns the Liquid and CSS sources.')]
#[IsReadOnly]
#[IsOpenWorld(false)]
final class ListTemplatesTool extends OpenbillTool
{
    protected function run(Request $request, Actor $actor): Response
    {
        return Output::json(array_map(
            fn (TemplateResource $template): array => Output::resource($template, TemplateResource::LIST),
            TemplateProvider::all(),
        ));
    }
}
