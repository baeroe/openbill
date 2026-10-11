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

it('stops huge output in nested loops while streaming, before memory runs out (review #2)', function () {
    // 10 000 × 15 × 150 KB would be ~22 GB: render() only checks the length at the end and dies with a fatal error
    memory_reset_peak_usage();
    $before = memory_get_usage();
    $start = microtime(true);

    $result = renderParts(
        ['body' => '{% for a in (1..10000) %}{% for b in (1..15) %}{{ long }}{% endfor %}{% endfor %}'],
        [...rendererContext(), 'long' => str_repeat('x', 150_000)],
    );

    expect($result->errors)->toHaveCount(1)
        ->and($result->errors[0]->part)->toBe(RenderPart::Body)
        ->and($result->errors[0]->message)->toBe(Text::t('rendering.error.limit'))
        ->and(memory_get_peak_usage() - $before)->toBeLessThan(128 * 1024 * 1024)
        ->and(microtime(true) - $start)->toBeLessThan(5);
});

it('stops an expensive filter in a loop at the deadline (review #2)', function () {
    config(['openbill.rendering.max_seconds' => 1]);
    $start = microtime(true);

    // each iteration splits a 90 KB string: within the render score limit this would run for about a minute
    $result = renderParts(
        ['body' => "x\n{% for a in (1..1000) %}{% for b in (1..100) %}{{ big | split: ',' | size }}{% endfor %}{% endfor %}"],
        [...rendererContext(), 'big' => str_repeat('a,', 45_000)],
    );

    expect($result->errors)->toHaveCount(1)
        ->and($result->errors[0]->part)->toBe(RenderPart::Body)
        ->and($result->errors[0]->message)->toBe(Text::t('rendering.error.time', ['seconds' => 1]))
        ->and(microtime(true) - $start)->toBeLessThan(3);
});

it('stops a chain of cheap filters at the deadline (re-review 3, I1)', function () {
    config(['openbill.rendering.max_seconds' => 1]);
    $start = microtime(true);

    // one output tag, no loop: only the filter calls themselves can notice the deadline (before: about a minute)
    $result = renderParts(
        ['body' => "x\n{{ s | split: ''".str_repeat(' | sort | reverse', 1000).' | size }}'],
        [...rendererContext(), 's' => str_repeat('a', 99_000)],
    );

    expect($result->errors)->toHaveCount(1)
        ->and($result->errors[0]->part)->toBe(RenderPart::Body)
        ->and($result->errors[0]->message)->toBe(Text::t('rendering.error.time', ['seconds' => 1]))
        ->and(microtime(true) - $start)->toBeLessThan(3);
});

it('locks body, header and footer down with a Content-Security-Policy as first head element (review #1, re-review M2)', function () {
    $result = renderParts(['body' => '<script>x()</script>', 'header' => 'h', 'footer' => 'f']);
    $csp = '<head><meta http-equiv="Content-Security-Policy" content="default-src \'none\'; img-src data:; font-src data:; style-src \'unsafe-inline\'; base-uri \'none\'; form-action \'none\'">';

    foreach ([$result->body, $result->header, $result->footer] as $html) {
        expect($html)->toContain($csp);
    }
});

it('stops a huge capture while it is being built (re-review #2)', function () {
    // capture rendered its block into one string and counted the length only afterwards: fatal error
    memory_reset_peak_usage();
    $before = memory_get_usage();

    $result = renderParts(
        ['body' => "x\n{% capture c %}{% for a in (1..1000) %}{% for b in (1..15) %}{{ long }}{% endfor %}{% endfor %}{% endcapture %}{{ c | size }}"],
        [...rendererContext(), 'long' => str_repeat('x', 150_000)],
    );

    expect($result->errors)->toHaveCount(1)
        ->and($result->errors[0]->part)->toBe(RenderPart::Body)
        ->and($result->errors[0]->message)->toBe(Text::t('rendering.error.limit'))
        ->and(memory_get_peak_usage() - $before)->toBeLessThan(128 * 1024 * 1024);
});

it('stops a string filter whose result would explode before it allocates it (re-review #2)', function (string $body) {
    memory_reset_peak_usage();
    $before = memory_get_usage();

    $result = renderParts(
        ['body' => "x\n{$body}"],
        [...rendererContext(), 'xs' => str_repeat('x', 30_000), 'ys' => str_repeat('y', 30_000),
            'x50k' => str_repeat('x', 50_000), 'x20k' => str_repeat('x', 20_000), 'y100k' => str_repeat('y', 100_000),
            'x150k' => str_repeat('x', 150_000), 'pct' => str_repeat('%', 100_000)],
    );

    expect($result->errors)->toHaveCount(1)
        ->and($result->errors[0]->part)->toBe(RenderPart::Body)
        ->and($result->errors[0]->message)->toBe(Text::t('rendering.error.limit'))
        ->and(memory_get_peak_usage() - $before)->toBeLessThan(128 * 1024 * 1024);
})->with([
    // 30 000 × 30 000 bytes = 900 MB in a single str_replace
    'replace' => ["{{ xs | replace: 'x', ys | size }}"],
    // 15 000 × 30 KB = 450 MB within one output tag
    'append' => ['{{ ys'.str_repeat(' | append: ys', 15_000).' | size }}'],
    // re-review 2: a big glue in join (5 GB / 2 GB) and a geometric base64 chain
    'join direct' => ["{{ x50k | split: '' | join: y100k | size }}"],
    'join on an assigned array' => ["{% assign a = x20k | split: '' %}{{ a | join: y100k | size }}"],
    'base64 chain' => ['{{ x150k'.str_repeat(' | base64_encode', 30).' | size }}'],
    'url_encode' => ['{{ pct'.str_repeat(' | url_encode | base64_encode', 20).' | size }}'],
]);

it('ends rendering cleanly when the memory budget is used up (re-review #2)', function () {
    config(['openbill.rendering.max_memory_bytes' => 2 * 1024 * 1024]);

    // 3 MB of output stay below the 5 MB output limit, but not below a 2 MB memory budget
    $result = renderParts(
        ['body' => "x\n{% for i in (1..3) %}{{ long | append: long }}{% endfor %}"],
        [...rendererContext(), 'long' => str_repeat('x', 500_000)],
    );

    expect($result->errors)->toHaveCount(1)
        ->and($result->errors[0]->message)->toBe(Text::t('rendering.error.memory'));
});

it('refuses a meta refresh with its part and line instead of letting Gotenberg fail (re-review M1)', function () {
    $result = renderParts([
        'body' => "<p>ok</p>\n<META HTTP-EQUIV='Refresh' content=\"0; url=http://web/\">",
        'footer' => '{{ "<meta http-equiv=refresh content=0>" }}',
    ]);

    expect(array_map(fn ($e) => [$e->part, $e->line], $result->errors))->toBe([[RenderPart::Body, 2], [RenderPart::Footer, 1]])
        ->and($result->errors[0]->message)->toBe(Text::t('rendering.error.meta_http_equiv'))
        ->and($result->body)->not->toContain('HTTP-EQUIV')
        ->and($result->footer)->not->toContain('http-equiv=refresh');
});

it('refuses every meta http-equiv of a template, also written with character references (re-review 2, M1)', function (string $meta) {
    $result = renderParts(['body' => "<p>ok</p>\n{$meta}"]);

    expect($result->errors)->toHaveCount(1)
        ->and($result->errors[0]->part)->toBe(RenderPart::Body)
        ->and($result->errors[0]->line)->toBe(2)
        ->and($result->errors[0]->message)->toBe(Text::t('rendering.error.meta_http_equiv'))
        // the CSP openbill puts into the head is not template content
        ->and($result->body)->toContain('<meta http-equiv="Content-Security-Policy"');
})->with([
    'character reference' => ['<meta http-equiv="&#114;efresh" content="0;url=http://example.com/">'],
    'hex reference' => ['<meta http-equiv="&#x52;EFRESH" content="0">'],
    'unquoted' => ['<META http-equiv=refresh content=0>'],
    'own CSP' => ['<meta http-equiv="Content-Security-Policy" content="default-src *">'],
    'set-cookie' => ["<meta http-equiv='set-cookie' content='a=b'>"],
]);
