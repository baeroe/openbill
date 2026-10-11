<?php

use App\Actions\SyncBuiltInTemplates;
use App\Enums\RenderScenario;
use App\Models\DocumentTypeSetting;
use App\Models\Template;
use App\Rendering\ContextBuilder;
use App\Rendering\LiquidRenderer;
use App\Rendering\ManifestValidator;
use App\Rendering\RenderOptions;
use App\Rendering\SampleDataFactory;
use App\Rendering\TemplatePackage;
use App\Rendering\TemplateSource;

it('ships Klar, Kante and Leise as built-in templates and uses Klar as default for every document type', function () {
    $klar = Template::query()->where('slug', 'klar')->firstOrFail();

    expect(Template::query()->where('built_in', true)->orderBy('slug')->pluck('name', 'slug')->all())->toBe(['kante' => 'Kante', 'klar' => 'Klar', 'leise' => 'Leise'])
        ->and(DocumentTypeSetting::query()->pluck('template_id')->unique()->values()->all())->toBe([$klar->id])
        ->and($klar->version)->toBe('1.0.0')
        ->and($klar->manifest['paper'])->toBe(['format' => 'A4', 'marginX' => '20mm', 'headerHeight' => '30mm', 'footerHeight' => '28mm']);
});

it('syncs idempotently and restores changed built-in templates', function () {
    Template::query()->where('slug', 'klar')->update(['body' => 'changed']);

    $first = app(SyncBuiltInTemplates::class)->handle(systemActor());
    $second = app(SyncBuiltInTemplates::class)->handle(systemActor());

    expect(array_keys($first))->toBe(['klar', 'kante', 'leise'])
        ->and($second['klar']->id)->toBe($first['klar']->id)
        ->and(Template::query()->count())->toBe(3)
        ->and($second['klar']->body)->toBe((string) file_get_contents(resource_path('templates/klar/template.liquid')));
});

it('has valid manifests for all built-in templates', function (string $slug) {
    expect(ManifestValidator::validate(TemplatePackage::fromDirectory(resource_path("templates/{$slug}"))->manifest))->toBe([]);
})->with(SyncBuiltInTemplates::SLUGS);

it('renders every built-in template with every scenario in both languages without errors', function (string $slug, RenderScenario $scenario) {
    foreach (['de', 'en'] as $locale) {
        $sample = app(SampleDataFactory::class)->make($scenario, $locale);
        $context = app(ContextBuilder::class)->build($sample->document, $sample->sources);
        $result = app(LiquidRenderer::class)->render(TemplateSource::fromModel(Template::query()->where('slug', $slug)->firstOrFail()), $context->data, new RenderOptions($locale));

        expect($result->errors)->toBe([])
            ->and($result->footer)->toContain('<span class="pageNumber"></span>')
            ->and($result->body)->not->toContain('openbill-error');
    }
})->with(SyncBuiltInTemplates::SLUGS)->with(RenderScenario::cases());

it('uses only words of the template vocabulary', function () {
    $lang = ['en' => json_decode((string) file_get_contents(lang_path('en.json')), true), 'de' => json_decode((string) file_get_contents(lang_path('de.json')), true)];
    $words = [];
    foreach (glob(resource_path('templates/*/*.liquid')) ?: [] as $file) {
        preg_match_all("/'([a-z_]+)'\\s*\\|\\s*t\\b/", (string) file_get_contents($file), $m);
        array_push($words, ...$m[1]);
    }

    expect($words)->not->toBeEmpty();
    foreach (array_unique($words) as $word) {
        expect($lang['en'])->toHaveKey("template.{$word}")
            ->and($lang['de'])->toHaveKey("template.{$word}");
    }
});

it('never compares amounts with == or != (string amounts, see docs)', function () {
    foreach (glob(resource_path('templates/*/*.liquid')) ?: [] as $file) {
        expect((string) file_get_contents($file))->not->toMatch('/(total|net|tax|percent)\s*(==|!=)\s*0/');
    }
});

it('syncs from the console', function () {
    $this->artisan('app:sync-templates')->expectsOutputToContain('klar, kante, leise')->assertSuccessful();
});
