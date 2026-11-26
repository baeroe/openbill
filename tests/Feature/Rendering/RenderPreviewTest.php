<?php

use App\Actions\CreateDocument;
use App\Actions\FinalizeDocument;
use App\Actions\RenderPreview;
use App\Enums\DocumentType;
use App\Exceptions\DocumentLockedException;
use App\Models\Customer;
use App\Models\Template;
use Illuminate\Support\Facades\Http;
use Illuminate\Validation\ValidationException;

it('answers with the shape of POST /api/render', function () {
    $result = app(RenderPreview::class)->handle(systemActor(), ['scenario' => 'short_invoice', 'locale' => 'de']);

    expect(array_keys($result->toArray()))->toBe(['header', 'body', 'footer', 'paper', 'errors', 'totals', 'issues'])
        ->and($result->toArray()['errors'])->toBe([])
        ->and($result->toArray()['totals']['gross'])->toBe('6485.50')
        ->and($result->toArray()['body'])->toContain('Hafenkontor Lindqvist GmbH');
    Http::assertNothingSent();
});

it('reports errors of an unsaved template instead of throwing (review focus 2)', function () {
    $klar = Template::query()->where('slug', 'klar')->firstOrFail();

    $result = app(RenderPreview::class)->handle(systemActor(), [
        'template_id' => $klar->id,
        'scenario' => 'long_invoice',
        'template' => ['body' => "<p>ok</p>\n{% for p in positions %}{{ p.title }"],
    ])->toArray();

    expect($result['errors'])->toBe([['part' => 'body', 'file' => 'template.liquid', 'line' => 2, 'message' => $result['errors'][0]['message']]])
        ->and($result['header'])->toContain('<span class="h-doc">');
});

it('previews unsaved draft changes with totals and compliance issues without saving them', function () {
    $document = draft(DocumentType::Invoice, [itemRow('Workshop', '10', '95')]);

    $result = app(RenderPreview::class)->handle(systemActor(), [
        'document_id' => $document->id,
        'draft' => ['groups' => [['title' => null, 'positions' => [itemRow('Workshop', '2', '95')]]]],
    ])->toArray();

    expect($result['totals']['net'])->toBe('190.00')
        ->and($result['issues'])->toBe([])
        ->and($document->fresh()->net_total)->toBe('950.00');
});

it('prefixes validation errors of the draft with draft.', function () {
    $document = draft();

    try {
        app(RenderPreview::class)->handle(systemActor(), ['document_id' => $document->id, 'draft' => ['groups' => [['positions' => [['kind' => 'item', 'quantity' => 'x']]]]]]);
        $this->fail('no exception');
    } catch (ValidationException $e) {
        expect(array_keys($e->errors()))->toBe(['draft.groups.0.positions.0.quantity']);
    }
});

it('renders a finalized document from its snapshot and refuses unsaved changes for it', function () {
    $customer = Customer::factory()->create(['name' => 'Hafenkontor Lindqvist GmbH']);
    $done = app(FinalizeDocument::class)->handle(systemActor(), draft(DocumentType::Invoice, [itemRow()], ['customer_id' => $customer->id]));
    $customer->forceFill(['name' => 'Renamed'])->save();

    $result = app(RenderPreview::class)->handle(systemActor(), ['document_id' => $done->id])->toArray();

    expect($result['body'])->toContain('Hafenkontor Lindqvist GmbH')->not->toContain('Renamed')
        ->and($result['issues'])->toBe([])
        ->and(fn () => app(RenderPreview::class)->handle(systemActor(), ['document_id' => $done->id, 'draft' => ['intro' => 'x']]))
        ->toThrow(DocumentLockedException::class);
});

it('needs exactly one source', function (array $input) {
    expect(fn () => app(RenderPreview::class)->handle(systemActor(), $input))->toThrow(ValidationException::class);
})->with([
    'none' => [[]],
    'both' => [['scenario' => 'short_invoice', 'document_id' => 'x']],
    'unknown scenario' => [['scenario' => 'huge_invoice']],
    'draft without document' => [['scenario' => 'short_invoice', 'draft' => ['intro' => 'x']]],
]);

it('renders a sample PDF from the console', function () {
    $out = storage_path('framework/testing/sample.pdf');

    $this->artisan('app:render-sample', ['template' => 'kante', 'scenario' => 'offer_with_options', '--locale' => 'en', '--out' => $out])
        ->expectsOutputToContain($out)
        ->assertSuccessful();

    expect((string) file_get_contents($out))->toStartWith('%PDF-');
    unlink($out);
});

it('previews a text document with title and Markdown as HTML and no table', function () {
    $document = app(CreateDocument::class)->handle(systemActor(), ['type' => 'text', 'title' => 'Terms', 'body' => "## One\n\n- a & b\n- <script>alert(1)</script>"]);

    $result = app(RenderPreview::class)->handle(systemActor(), ['document_id' => $document->id])->toArray();

    expect($result['errors'])->toBe([])
        ->and($result['body'])->toContain('<h1>Terms</h1>')->and($result['body'])->toContain('<h2>One</h2>')
        ->and($result['body'])->toContain('<li>a &amp; b</li>')
        // markdown escapes the raw tag itself, it is not escaped twice
        ->and($result['body'])->toContain('&lt;script&gt;alert(1)&lt;/script&gt;')->not->toContain('&amp;lt;')->not->toContain('<script')
        ->and($result['body'])->not->toContain('<table');

    $preview = app(RenderPreview::class)->handle(systemActor(), ['document_id' => $document->id, 'draft' => ['title' => 'New title', 'body' => 'Changed *text*']])->toArray();
    expect($preview['body'])->toContain('New title')->and($preview['body'])->toContain('Changed <em>text</em>');
});

it('renders a finalized text document from its snapshot', function () {
    $document = app(CreateDocument::class)->handle(systemActor(), ['type' => 'text', 'title' => 'Terms', 'body' => 'Frozen text']);
    $done = app(FinalizeDocument::class)->handle(systemActor(), $document);

    expect(app(RenderPreview::class)->handle(systemActor(), ['document_id' => $done->id])->toArray()['body'])->toContain('Frozen text')->toContain($done->number);
});
