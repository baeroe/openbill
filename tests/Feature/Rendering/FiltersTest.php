<?php

use App\Rendering\Liquid\LiquidEnvironment;
use App\Rendering\Liquid\RenderEnv;
use Keepsuit\Liquid\Exceptions\ResourceLimitException;
use Keepsuit\Liquid\Exceptions\StandardException;
use Keepsuit\Liquid\Exceptions\SyntaxException;
use Keepsuit\Liquid\Exceptions\UndefinedFilterException;

/**
 * @param  array<string, mixed>  $data
 * @param  array<string, array<string, string>>  $translations
 */
function liquid(string $source, array $data = [], string $locale = 'de', array $translations = []): string
{
    $environment = LiquidEnvironment::make();

    return $environment->parseString($source)->render($environment->newRenderContext(
        data: $data,
        registers: [RenderEnv::REGISTER => new RenderEnv($locale, $translations)],
    ));
}

it('formats money in the document language without floats', function (string $value, string $locale, string $expected) {
    expect(liquid('{{ v | money }}', ['v' => $value], $locale))->toBe($expected);
})->with([
    ['1234.5', 'de', '1.234,50 €'],
    ['1234.5', 'en', '€1,234.50'],
    ['-0.5', 'de', '-0,50 €'],
    ['-0.5', 'en', '-€0.50'],
    ['-0.004', 'de', '0,00 €'],
    ['1234567890123.45', 'de', '1.234.567.890.123,45 €'],
    ['0.125', 'en', '€0.13'],
]);

it('takes the number of decimals as argument and ignores what is not a number', function () {
    expect(liquid('{{ v | money: 4 }}', ['v' => '12.3456']))->toBe('12,3456 €')
        ->and(liquid('{{ v | money }}', ['v' => 7]))->toBe('7,00 €')
        ->and(liquid('[{{ missing | money }}]'))->toBe('[]')
        ->and(liquid('[{{ v | money }}]', ['v' => 'abc']))->toBe('[]')
        ->and(liquid('{{ 3 | times: 1.5 | money }}'))->toBe('4,50 €');
});

it('formats numbers', function () {
    expect(liquid('{{ v | number }}', ['v' => '1234.5']))->toBe('1.234,50')
        ->and(liquid('{{ v | number: 2 }}', ['v' => '1234.5'], 'en'))->toBe('1,234.50')
        ->and(liquid('{{ v | number: 0 }}', ['v' => '1234.5']))->toBe('1.235')
        ->and(liquid('{{ v | number: 3 }}', ['v' => '-1.5']))->toBe('-1,500');
});

it('formats dates per language or with a strftime pattern', function () {
    expect(liquid('{{ d | date }}', ['d' => '2026-10-04']))->toBe('04.10.2026')
        ->and(liquid('{{ d | date }}', ['d' => '2026-10-04'], 'en'))->toBe('Oct 4, 2026')
        ->and(liquid('{{ d | date: "%Y/%m/%d" }}', ['d' => '2026-10-04']))->toBe('2026/10/04')
        ->and(liquid('[{{ d | date }}]', ['d' => null]))->toBe('[]')
        ->and(liquid('{{ d | date }}', ['d' => 'not a date']))->toBe('not a date');
});

it('turns line breaks into <br> without escaping again (context values are escaped already)', function () {
    expect(liquid('{{ s | nl2br }}', ['s' => "a &amp; b\nc\r\nd"]))->toBe('a &amp; b<br>c<br>d');
});

it('translates template words: manifest first, then the built-in vocabulary, else the key', function () {
    expect(liquid("{{ 'number' | t }}"))->toBe('Nummer')
        ->and(liquid("{{ 'number' | t }}", [], 'en'))->toBe('Number')
        ->and(liquid("{{ 'number' | t }}", [], 'de', ['de' => ['number' => 'Nr.']]))->toBe('Nr.')
        ->and(liquid("{{ 'hotline' | t }}", [], 'de', ['en' => ['hotline' => 'Hotline']]))->toBe('hotline');
});

it('refuses unknown filters, unbounded ranges, tablerow and partials', function (string $source, string $exception) {
    expect(fn () => liquid($source))->toThrow($exception);
})->with([
    'unknown filter' => ['{{ 1 | nope }}', UndefinedFilterException::class],
    'huge range' => ['{% for i in (1..100000000) %}{% endfor %}', StandardException::class],
    'tablerow' => ['{% tablerow i in (1..3) %}{{ i }}{% endtablerow %}', SyntaxException::class],
    'render' => ["{% render 'other' %}", Exception::class],
]);

it('stops nested empty loops at the render limit within a fraction of a second', function () {
    $start = microtime(true);

    expect(fn () => liquid('{% for a in (1..9999) %}{% for b in (1..9999) %}{% endfor %}{% endfor %}'))
        ->toThrow(ResourceLimitException::class)
        ->and(microtime(true) - $start)->toBeLessThan(5);
});

it('has the vocabulary of the built-in templates in both languages', function () {
    $words = ['amount_due', 'credit', 'customer_number', 'date', 'details', 'draft', 'due_date', 'for', 'net', 'number', 'number_short',
        'of', 'offer_total', 'optional', 'optional_total', 'page', 'pos', 'price', 'project', 'quantity', 'reference', 'service',
        'service_date', 'subtotal', 'sum', 'tax_number', 'total', 'unit_price', 'valid_until', 'vat', 'vat_id', 'vat_long', 'vat_on'];

    foreach (['en', 'de'] as $locale) {
        $lang = json_decode((string) file_get_contents(lang_path("{$locale}.json")), true);
        foreach ($words as $word) {
            expect($lang)->toHaveKey("template.{$word}");
        }
    }
});

it('does Liquid math on amounts with decimals, not floats (review #6)', function () {
    expect(liquid('{{ a | plus: b }}', ['a' => '0.1', 'b' => '0.2']))->toBe('0.3')
        ->and(liquid('{{ v | times: 1.19 }}', ['v' => '1130.50']))->toBe('1345.2950')
        ->and(liquid('{{ v | times: 1.19 | money }}', ['v' => '1130.50']))->toBe('1.345,30 €')
        ->and(liquid('{{ v | minus: "0.01" }}', ['v' => '1.00']))->toBe('0.99')
        ->and(liquid('{{ v | round: 2 }}', ['v' => '1.005']))->toBe('1.01')
        ->and(liquid('{{ v | divided_by: 3 | round: 2 }}', ['v' => '10.00']))->toBe('3.33')
        // integers keep Liquid's integer semantics (loop counters, integer division)
        ->and(liquid('{{ 10 | divided_by: 4 }}|{{ 3 | plus: 4 }}|{{ 2 | times: 3 }}|{{ 7 | round }}'))->toBe('2|7|6|7')
        ->and(fn () => liquid('{{ 1 | divided_by: 0 }}'))->toThrow(Exception::class);
});

it('does not escape context values twice with escape (review #7)', function () {
    expect(liquid('{{ s | escape }}', ['s' => 'a &amp; b &lt;c&gt;']))->toBe('a &amp; b &lt;c&gt;')
        ->and(liquid('{{ "<b>" | escape }}'))->toBe('&lt;b&gt;');
});
