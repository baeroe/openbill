<?php

use App\Rendering\Markdown;

it('renders headings, lists and emphasis', function () {
    $html = Markdown::toHtml("## Title\n\n- one\n- **two**\n");

    expect($html)->toContain('<h2>Title</h2>')->and($html)->toContain('<li>one</li>')->and($html)->toContain('<strong>two</strong>');
});

it('escapes raw HTML', function () {
    $html = Markdown::toHtml("<script>alert(1)</script>\n\nText <b onclick=\"x()\">bold</b>");

    expect($html)->not->toContain('<script')->not->toContain('<b ')->and($html)->toContain('&lt;script&gt;');
});

it('drops the target of unsafe links but keeps safe ones', function () {
    $html = Markdown::toHtml('[bad](javascript:alert(1)) [data](data:text/html;base64,AAAA) [ok](https://nordlicht.example/agb)');

    expect($html)->not->toContain('javascript:')->not->toContain('data:text')
        ->and($html)->toContain('href="https://nordlicht.example/agb"');
});

it('shows images as their alt text', function () {
    $html = Markdown::toHtml('![Logo of the studio](https://tracker.example/pixel.png)');

    expect($html)->not->toContain('<img')->not->toContain('tracker.example')->and($html)->toContain('Logo of the studio');
});
