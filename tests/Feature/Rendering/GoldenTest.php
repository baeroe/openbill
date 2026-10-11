<?php

use App\Enums\RenderScenario;
use App\Models\Template;
use App\Rendering\ContextBuilder;
use App\Rendering\LiquidRenderer;
use App\Rendering\RenderOptions;
use App\Rendering\SampleDataFactory;
use App\Rendering\TemplateSource;

/*
 * Approved HTML of the built-in templates with sample data. After an intended change:
 *   ddev exec 'UPDATE_GOLDEN=1 php artisan test --filter=GoldenTest'
 * then look at the diff (git diff tests/Feature/Rendering/golden) and at the PDF (php artisan app:render-sample).
 */
it('renders the built-in templates exactly like the approved output', function (string $slug, RenderScenario $scenario, string $locale) {
    $sample = app(SampleDataFactory::class)->make($scenario, $locale);
    $context = app(ContextBuilder::class)->build($sample->document, $sample->sources);
    $result = app(LiquidRenderer::class)->render(TemplateSource::fromModel(Template::query()->where('slug', $slug)->firstOrFail()), $context->data, new RenderOptions($locale));

    expect($result->errors)->toBe([]);
    foreach (['header' => $result->header, 'body' => $result->body, 'footer' => $result->footer] as $part => $html) {
        $file = __DIR__."/golden/{$slug}-{$scenario->value}-{$locale}.{$part}.html";
        if (getenv('UPDATE_GOLDEN') === '1') {
            file_put_contents($file, $html);
        }
        expect(is_file($file))->toBeTrue("missing {$file}: run with UPDATE_GOLDEN=1")
            ->and($html)->toBe((string) file_get_contents($file));
    }
})->with([
    'klar short invoice de' => ['klar', RenderScenario::ShortInvoice, 'de'],
    'klar long invoice en' => ['klar', RenderScenario::LongInvoice, 'en'],
    'kante offer with options en' => ['kante', RenderScenario::OfferWithOptions, 'en'],
    'kante small business de' => ['kante', RenderScenario::SmallBusiness, 'de'],
    'leise reverse charge de' => ['leise', RenderScenario::ReverseCharge, 'de'],
]);
