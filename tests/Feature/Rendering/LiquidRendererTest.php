<?php

use App\Enums\RenderPart;
use App\Rendering\LiquidRenderer;
use App\Rendering\RenderOptions;
use App\Rendering\RenderResult;
use App\Rendering\TemplateSource;
use App\Support\Text;

/**
 * @param  array<string, mixed>  $parts  header, body, footer, css, manifest, assets
 * @param  array<string, mixed>|null  $context
 */
function renderParts(array $parts, ?array $context = null, ?RenderOptions $options = null): RenderResult
{
    return app(LiquidRenderer::class)->render(
        new TemplateSource($parts['header'] ?? '', $parts['body'] ?? '', $parts['footer'] ?? '', $parts['css'] ?? '', $parts['manifest'] ?? [], $parts['assets'] ?? []),
        $context ?? rendererContext(),
        $options ?? new RenderOptions('de'),
    );
}

/** @return array<string, mixed> */
function rendererContext(array $document = [], ?array $customer = null): array
{
    return [
        'org' => ['name' => 'Studio <Nordlicht>'],
        'customer' => $customer,
        'contact' => ['first_name' => 'Ida'],
        'document' => [
            'type_label' => 'Rechnung', 'number' => 'RE-1', 'date' => '2026-10-04', 'gross_total' => '1234.50',
            'intro' => 'Hallo {{ contact.first_name }}', 'closing' => "Zeile 1\nZeile 2", ...$document,
        ],
        'positions' => [],
        'groups' => [],
    ];
}

it('renders values with the filters and escapes context values', function () {
    $result = renderParts(['body' => '{{ document.date | date }}|{{ document.gross_total | money }}|{{ org.name }}']);

    expect($result->errors)->toBe([])
        ->and($result->body)->toContain('04.10.2026|1.234,50 €|Studio &lt;Nordlicht&gt;');
});

it('renders Liquid inside intro and closing, nl2br keeps the line breaks', function () {
    $result = renderParts(['body' => '{{ document.intro | nl2br }}#{{ document.closing | nl2br }}']);

    expect($result->body)->toContain('Hallo Ida#Zeile 1<br>Zeile 2');
});

it('escapes customer data inside the intro exactly once', function () {
    $context = rendererContext(['intro' => 'Für {{ customer.name }}'], ['name' => 'Müller & Söhne "Nord"']);

    $viaNl2br = renderParts(['body' => '{{ document.intro | nl2br }}'], $context);
    $plain = renderParts(['body' => '{{ document.intro }}'], $context);

    expect($viaNl2br->body)->toContain('Für Müller &amp; Söhne &quot;Nord&quot;')
        ->and($plain->body)->toContain('Für Müller &amp; Söhne &quot;Nord&quot;')
        ->and($viaNl2br->body)->not->toContain('&amp;amp;');
});

it('renders header and footer as separate documents with Chromium page placeholders', function () {
    $result = renderParts([
        'body' => 'Inhalt',
        'header' => '<b>{{ document.number }}</b>',
        'footer' => 'Seite {{ page.number }} von {{page.total}}',
    ]);

    expect($result->header)->toContain('<b>RE-1</b>')->not->toContain('Inhalt')
        ->and($result->footer)->toContain('Seite <span class="pageNumber"></span> von <span class="totalPages"></span>')
        ->and($result->body)->not->toContain('pageNumber')
        ->and($result->body)->toStartWith('<!doctype html><html lang="de">');
});

it('lays out body, header and footer for the paper of the manifest', function () {
    $result = renderParts([
        'body' => 'x', 'header' => 'h', 'footer' => 'f', 'css' => 'h1 { color: red; }',
        'manifest' => ['paper' => ['format' => 'A4', 'marginX' => '20mm', 'headerHeight' => '30mm', 'footerHeight' => '28mm']],
    ]);

    expect($result->paper->toArray())->toBe(['format' => 'A4', 'marginX' => '20mm', 'headerHeight' => '30mm', 'footerHeight' => '28mm'])
        ->and($result->body)->toContain('body{margin:0;width:642.52px}')->toContain('h1 { color: red; }')
        ->and($result->header)->toContain('width:793.70px;height:113.39px')->not->toContain('color: red')
        ->and($result->footer)->toContain('width:793.70px;height:105.83px');
});

it('reports a syntax error with part and line and shows an error box instead of throwing', function () {
    $result = renderParts(['body' => "a\nb\n{% for p in positions %}{{ p.title }"]);

    expect($result->errors)->toHaveCount(1)
        ->and($result->errors[0]->part)->toBe(RenderPart::Body)
        ->and($result->errors[0]->line)->toBe(3)
        ->and($result->body)->toContain('class="openbill-error"');
});

it('reports unknown filters and errors in the footer with their part', function () {
    $result = renderParts(['body' => "ok\n{{ document.number | shout }}", 'footer' => '{% if %}']);

    expect(array_map(fn ($e) => [$e->part, $e->line], $result->errors))->toBe([[RenderPart::Body, 2], [RenderPart::Footer, 1]])
        ->and($result->errors[0]->message)->toContain('shout')
        ->and($result->header)->not->toContain('openbill-error');
});

it('stops endless loops and too much output with a readable message', function (string $body) {
    $start = microtime(true);
    $result = renderParts(['body' => $body], [...rendererContext(), 'long' => str_repeat('x', 1000)]);

    expect($result->errors)->toHaveCount(1)
        ->and($result->errors[0]->message)->toBe(Text::t('rendering.error.limit'))
        ->and(microtime(true) - $start)->toBeLessThan(5);
})->with([
    'nested loops' => ['{% for a in (1..9999) %}{% for b in (1..9999) %}{% endfor %}{% endfor %}'],
    'output' => ['{% for i in (1..9000) %}{{ long }}{% endfor %}'],
]);

it('refuses a huge range with its line', function () {
    $result = renderParts(['body' => "x\n{% for i in (1..100000000) %}{% endfor %}"]);

    expect($result->errors[0]->line)->toBe(2)
        ->and($result->errors[0]->message)->toBe(Text::t('rendering.error.range', ['max' => 10000]));
});

it('refuses a template part larger than the limit without parsing it', function () {
    $result = renderParts(['header' => str_repeat('{{ x }}', 40000)]);

    expect($result->errors)->toHaveCount(1)
        ->and($result->errors[0]->part)->toBe(RenderPart::Header)
        ->and($result->errors[0]->message)->toBe(Text::t('rendering.error.too_large', ['kb' => 200]));
});

it('refuses partials, </style> in the CSS and an invalid paper', function () {
    $result = renderParts([
        'body' => "{% render 'x' %}",
        'css' => "h1{}\n</style><script>alert(1)</script>",
        'manifest' => ['paper' => ['format' => 'A3']],
    ]);

    expect(array_map(fn ($e) => $e->part, $result->errors))->toBe([RenderPart::Manifest, RenderPart::Css, RenderPart::Body])
        ->and($result->errors[1]->line)->toBe(2)
        ->and($result->body)->not->toContain('<script>')
        ->and($result->paper->format)->toBe('A4');
});

it('keeps a broken intro as plain text and reports it', function () {
    $result = renderParts(['body' => '{{ document.intro }}'], rendererContext(['intro' => 'Hallo {{ contact.first_name ']));

    expect($result->errors[0]->part)->toBe(RenderPart::Intro)
        ->and($result->body)->toContain('Hallo {{ contact.first_name');
});

it('puts a watermark on every page of a draft only when asked to', function () {
    expect(renderParts(['body' => 'x'], null, new RenderOptions('de', 'ENTWURF'))->body)->toContain('<div class="openbill-draft-mark">ENTWURF</div>')
        ->and(renderParts(['body' => 'x'])->body)->not->toContain('openbill-draft-mark');
});

it('inlines template assets as data URLs in all parts and in the CSS', function () {
    $result = renderParts([
        'header' => '<img src="assets/logo.svg">',
        'body' => "<img src='./assets/logo.svg'><img src=\"assets/missing.png\">",
        'css' => '@font-face { src: url(assets/font.woff2); }',
        'assets' => [
            'assets/logo.svg' => ['mime' => 'image/svg+xml', 'contents' => '<svg/>'],
            'assets/font.woff2' => ['mime' => 'font/woff2', 'contents' => 'FONT'],
        ],
    ]);

    expect($result->header)->toContain('src="data:image/svg+xml;base64,'.base64_encode('<svg/>').'"')
        ->and($result->body)->toContain("src='data:image/svg+xml;base64,")
        ->and($result->body)->toContain('src="assets/missing.png"')
        ->and($result->body)->toContain('url(data:font/woff2;base64,'.base64_encode('FONT').')');
});

it('uses the template translations from the manifest', function () {
    $result = renderParts(['body' => "{{ 'number' | t }}", 'manifest' => ['translations' => ['de' => ['number' => 'Beleg-Nr.']]]]);

    expect($result->body)->toContain('Beleg-Nr.');
});
