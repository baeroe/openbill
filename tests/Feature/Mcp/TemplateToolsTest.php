<?php

use App\Mcp\Tools\GetTemplateTool;
use App\Mcp\Tools\ListTemplatesTool;
use App\Mcp\Tools\UpdateTemplateTool;
use App\Models\Template;

beforeEach(fn () => $this->withToken(apiToken(['api:read'])));

it('lists the templates without their sources, like GET /api/templates', function () {
    $list = mcpJson(mcpTool(ListTemplatesTool::class)->assertOk());

    expect($list)->toBe($this->getJson('/api/templates')->json())
        ->and(collect($list)->pluck('slug'))->toContain('klar', 'kante', 'leise')
        ->and($list[0])->not->toHaveKeys(['body', 'header', 'css', 'manifest']);
});

it('returns one template with all parts, like GET /api/templates/{id}', function () {
    $klar = Template::query()->where('slug', 'klar')->sole();

    $template = mcpJson(mcpTool(GetTemplateTool::class, ['id' => $klar->id])->assertOk());

    expect($template)->toBe($this->getJson("/api/templates/{$klar->id}")->json())
        ->and($template['built_in'])->toBeTrue()
        ->and($template['body'])->not->toBe('');
    mcpTool(GetTemplateTool::class, ['id' => '01jaaaaaaaaaaaaaaaaaaaaaaa'])->assertHasErrors(['There is no template']);
});

it('writes template parts and the manifest, never assets', function () {
    $template = Template::factory()->create(['name' => 'Fjord', 'slug' => 'fjord']);

    $summary = mcpJson(mcpTool(UpdateTemplateTool::class, [
        'id' => $template->id,
        'body' => '<h1>{{ document.number }}</h1>',
        'manifest' => ['name' => 'Fjord', 'version' => '1.1.0'],
        'assets' => ['assets/logo.svg' => base64_encode('<svg xmlns="http://www.w3.org/2000/svg"></svg>')],
    ])->assertOk());

    expect($summary)->toMatchArray(['id' => $template->id, 'version' => '1.1.0'])
        ->and($summary)->not->toHaveKey('body')
        ->and($template->fresh()->body)->toBe('<h1>{{ document.number }}</h1>')
        ->and($template->assets()->count())->toBe(0);
});

it('refuses a broken manifest with its path and keeps built-in templates read-only', function () {
    $template = Template::factory()->create();
    $klar = Template::query()->where('slug', 'klar')->sole();

    mcpTool(UpdateTemplateTool::class, ['id' => $template->id, 'manifest' => ['name' => 'x', 'version' => 'one']])->assertHasErrors(['- manifest.version: ']);
    mcpTool(UpdateTemplateTool::class, ['id' => $klar->id, 'body' => 'x'])->assertHasErrors(['(reason: template_built_in)']);

    expect($template->fresh()->version)->toBe($template->version)
        ->and($klar->fresh()->body)->not->toBe('x');
});
