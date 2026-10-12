<?php

namespace App\Mcp\Tools;

use App\ApiResource\TextBlockResource;
use App\Enums\TextBlockKind;
use App\Mcp\Output;
use App\Models\TextBlock;
use App\Support\Actor;
use Illuminate\Contracts\JsonSchema\JsonSchema;
use Illuminate\Validation\Rule;
use Laravel\Mcp\Request;
use Laravel\Mcp\Response;
use Laravel\Mcp\Server\Attributes\Description;
use Laravel\Mcp\Server\Attributes\Name;
use Laravel\Mcp\Server\Tools\Annotations\IsReadOnly;

#[Name('list-text-blocks')]
#[Description('Reusable texts (intro, closing, payment, note) with Liquid placeholders. Put their body into intro or closing of a draft with update-document.')]
#[IsReadOnly]
final class ListTextBlocksTool extends OpenbillTool
{
    protected function run(Request $request, Actor $actor): Response
    {
        $data = $request->validate(['kind' => ['sometimes', Rule::enum(TextBlockKind::class)]]);

        // same order as GET /api/text-blocks
        return Output::json(TextBlock::query()
            ->when($data['kind'] ?? null, fn ($query, string $kind) => $query->where('kind', $kind))
            ->orderBy('kind')->orderBy('name')->get()
            ->map(fn (TextBlock $block): array => Output::resource(TextBlockResource::fromModel($block)))->values()->all());
    }

    /**
     * @return array<string, mixed>
     */
    public function schema(JsonSchema $schema): array
    {
        return ['kind' => $schema->string()->enum(['intro', 'closing', 'payment', 'note'])];
    }
}
