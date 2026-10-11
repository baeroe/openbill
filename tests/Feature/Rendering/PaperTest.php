<?php

use App\Enums\RenderPart;
use App\Models\Template;
use App\Models\TemplateAsset;
use App\Rendering\Paper;
use App\Rendering\RenderError;
use App\Rendering\RenderResult;
use App\Rendering\TemplateSource;
use Illuminate\Support\Facades\Storage;

it('converts print lengths to CSS pixels at 96 dpi without floats', function () {
    expect((string) Paper::lengthToPx('25.4mm'))->toBe('96.00')
        ->and((string) Paper::lengthToPx('1in'))->toBe('96.00')
        ->and((string) Paper::lengthToPx('2.54cm'))->toBe('96.00')
        ->and((string) Paper::lengthToPx('72pt'))->toBe('96.00')
        ->and((string) Paper::lengthToPx('10px'))->toBe('10.00')
        ->and((string) Paper::lengthToPx('nonsense'))->toBe('0.00');
});

it('derives the page geometry like Chromium (header and footer are the top and bottom margins)', function () {
    $paper = new Paper('A4', '20mm', '30mm', '28mm');

    expect((string) $paper->pageWidthPx())->toBe('793.70')
        ->and((string) $paper->contentWidthPx())->toBe('642.52')
        ->and((string) $paper->headerHeightPx())->toBe('113.39')
        ->and((string) $paper->footerHeightPx())->toBe('105.83')
        ->and($paper->size())->toBe(['210mm', '297mm'])
        ->and((new Paper('Letter', '1in', '1in', '1in'))->size())->toBe(['8.5in', '11in']);
});

it('reads the paper from the manifest and falls back to defaults for missing or invalid values', function () {
    expect(Paper::fromManifest([])->toArray())->toBe(['format' => 'A4', 'marginX' => '20mm', 'headerHeight' => '30mm', 'footerHeight' => '20mm'])
        ->and(Paper::fromManifest(['paper' => ['format' => 'Letter', 'marginX' => '16mm']])->toArray())
        ->toBe(['format' => 'Letter', 'marginX' => '16mm', 'headerHeight' => '30mm', 'footerHeight' => '20mm'])
        ->and(Paper::fromManifest(['paper' => ['format' => 'A3', 'marginX' => 'wide']])->toArray())
        ->toBe(Paper::DEFAULT);
});

it('reports invalid paper settings with their path', function () {
    expect(Paper::errors(null))->toBe([])
        ->and(Paper::errors(['format' => 'A4', 'marginX' => '20mm']))->toBe([])
        ->and(array_keys(Paper::errors(['format' => 'A3', 'headerHeight' => '3 cm', 'footerHeight' => 12])))
        ->toBe(['paper.format', 'paper.headerHeight', 'paper.footerHeight'])
        ->and(array_keys(Paper::errors('A4')))->toBe(['paper']);
});

it('serializes render results and errors for the API (file and line for the toolkit)', function () {
    $result = new RenderResult('<h>', '<b>', '<f>', Paper::fromManifest([]), [new RenderError(RenderPart::Body, 3, 'Unknown tag')]);

    expect($result->ok())->toBeFalse()
        ->and($result->toArray())->toBe([
            'header' => '<h>',
            'body' => '<b>',
            'footer' => '<f>',
            'paper' => Paper::DEFAULT,
            'errors' => [['part' => 'body', 'file' => 'template.liquid', 'line' => 3, 'message' => 'Unknown tag']],
        ])
        ->and(RenderPart::Intro->file())->toBeNull();
});

it('builds a template source from a model with its assets and from a snapshot row', function () {
    $template = Template::factory()->create(['header' => 'H', 'body' => 'B', 'footer' => 'F', 'css' => 'C', 'manifest' => ['name' => 'X']]);
    Storage::disk('local')->put("templates/{$template->id}/assets/logo.svg", '<svg/>');
    TemplateAsset::query()->create(['template_id' => $template->id, 'path' => 'assets/logo.svg', 'mime' => 'image/svg+xml', 'storage_path' => "templates/{$template->id}/assets/logo.svg", 'size' => 6]);

    $source = TemplateSource::fromModel($template->fresh());
    $snapshot = TemplateSource::fromSnapshot(['id' => $template->id, 'header' => 'h1', 'body' => 'b1', 'footer' => null, 'css' => 'c1', 'manifest' => ['paper' => ['format' => 'Letter']]]);

    expect([$source->header, $source->body, $source->footer, $source->css, $source->manifest])->toBe(['H', 'B', 'F', 'C', ['name' => 'X']])
        ->and($source->assets)->toBe(['assets/logo.svg' => ['mime' => 'image/svg+xml', 'contents' => '<svg/>']])
        ->and([$snapshot->header, $snapshot->body, $snapshot->footer])->toBe(['h1', 'b1', ''])
        ->and($snapshot->assets)->toHaveKey('assets/logo.svg')
        ->and($source->with(['body' => 'new', 'manifest' => ['name' => 'Y']])->body)->toBe('new')
        ->and($source->with(['body' => 'new'])->assets)->toBe($source->assets)
        ->and(TemplateSource::fromSnapshot([])->body)->toBe('');
});

it('refuses margins that leave no room for the content (review #8)', function () {
    expect(array_keys(Paper::errors(['marginX' => '105mm'])))->toBe(['paper.marginX'])
        ->and(array_keys(Paper::errors(['headerHeight' => '150mm', 'footerHeight' => '130mm'])))->toBe(['paper.headerHeight'])
        ->and(Paper::errors(['format' => 'Letter', 'marginX' => '1in', 'headerHeight' => '2in', 'footerHeight' => '2in']))->toBe([])
        ->and(Paper::fromManifest(['paper' => ['marginX' => '200mm']])->marginX)->toBe('20mm');
});
