<?php

use App\Enums\DocumentType;
use App\Enums\FieldScope;
use App\Enums\FieldType;
use App\Mcp\Tools\RenderTemplatePreviewTool;
use App\Models\FieldDefinition;
use App\Models\Template;
use App\Models\User;
use Illuminate\Support\Facades\Http;
use Tests\Support\GotenbergFake;

it('reports errors, page count, missing fields and a text excerpt, never the HTML parts', function () {
    $preview = mcpJson(mcpTool(RenderTemplatePreviewTool::class, ['scenario' => 'long_invoice'])->assertOk());

    expect($preview)->toHaveKeys(['errors', 'page_count', 'page_count_skipped', 'missing_fields', 'issues', 'totals', 'paper', 'text_excerpt'])
        ->not->toHaveKeys(['header', 'body', 'footer'])
        ->and($preview['errors'])->toBe([])
        ->and($preview['page_count'])->toBe(1) // GotenbergFake: one page in the page tree
        ->and($preview['page_count_skipped'])->toBeNull()
        ->and($preview['text_excerpt'])->not->toContain('<')
        ->and(mb_strlen($preview['text_excerpt']))->toBeLessThanOrEqual(1501);
});

it('turns the rendered body into a short plain text without styles', function () {
    $klar = Template::query()->where('slug', 'klar')->sole();

    $preview = mcpJson(mcpTool(RenderTemplatePreviewTool::class, [
        'template_id' => $klar->id,
        'scenario' => 'short_invoice',
        'template' => [
            'body' => '<p>Hello {{ customer.name }}</p>{% for i in (1..400) %}<span>line {{ i }}</span> {% endfor %}',
            'css' => 'p { color: red }',
        ],
    ])->assertOk());

    expect($preview['text_excerpt'])->toContain('Hello ')
        ->toEndWith('…')
        ->not->toContain('color: red')
        ->and(mb_strlen($preview['text_excerpt']))->toBe(1501);
});

it('reports Liquid errors with part and line and renders no PDF', function () {
    $preview = mcpJson(mcpTool(RenderTemplatePreviewTool::class, [
        'scenario' => 'short_invoice',
        'template' => ['body' => "<p>ok</p>\n{% for p in positions %}{{ p.title }"],
    ])->assertOk());

    expect($preview['errors'][0])->toMatchArray(['part' => 'body', 'line' => 2])
        ->and($preview['page_count'])->toBeNull()
        ->and($preview['page_count_skipped'])->toBe('template_errors');
    Http::assertNothingSent();
});

it('names expected fields of the manifest that are not defined or have another type', function (?string $definedType, array $missing) {
    $klar = Template::query()->where('slug', 'klar')->sole();
    if ($definedType !== null) {
        FieldDefinition::factory()->create(['scope' => FieldScope::Document, 'key' => 'po_number', 'label' => 'PO number', 'type' => FieldType::from($definedType), 'doc_types' => ['invoice']]);
    }
    $manifest = [...$klar->manifest, 'expectedFields' => [['scope' => 'document', 'key' => 'po_number', 'type' => 'text', 'label' => 'PO number']]];

    $preview = mcpJson(mcpTool(RenderTemplatePreviewTool::class, ['template_id' => $klar->id, 'scenario' => 'short_invoice', 'template' => ['manifest' => $manifest]])->assertOk());

    expect($preview['missing_fields'])->toBe($missing);
})->with([
    'not defined' => [null, [['scope' => 'document', 'key' => 'po_number', 'type' => 'text', 'label' => 'PO number', 'problem' => 'not_defined']]],
    'another type' => ['number', [['scope' => 'document', 'key' => 'po_number', 'type' => 'text', 'label' => 'PO number', 'problem' => 'other_type']]],
    'defined' => ['text', []],
]);

it('keeps the preview when the PDF service fails and leaves the page count open', function () {
    GotenbergFake::failWithError();

    $preview = mcpJson(mcpTool(RenderTemplatePreviewTool::class, ['scenario' => 'short_invoice'])->assertOk());

    expect($preview['errors'])->toBe([])
        ->and($preview['page_count'])->toBeNull()
        ->and($preview['page_count_skipped'])->toBe('pdf_unavailable');
});

it('renders at most preview_pdfs_per_minute PDFs per caller and skips the page count above it (review #1)', function () {
    config(['openbill.mcp.preview_pdfs_per_minute' => 2]);
    $agent = User::factory()->create();
    $preview = fn (User $user): array => mcpJson(mcpTool(RenderTemplatePreviewTool::class, ['scenario' => 'short_invoice'], $user)->assertOk());
    $pdfRequests = fn (): int => Http::recorded(fn ($request) => str_contains($request->url(), '/forms/chromium/convert/html'))->count();

    expect($preview($agent)['page_count'])->toBe(1)
        ->and($preview($agent)['page_count'])->toBe(1);
    $limited = $preview($agent);

    expect($limited)->toMatchArray(['errors' => [], 'page_count' => null, 'page_count_skipped' => 'rate_limited'])
        ->and($limited['text_excerpt'])->not->toBe('')
        ->and($pdfRequests())->toBe(2)
        // the limit is per caller: someone else still gets a page count
        ->and($preview(User::factory()->create())['page_count'])->toBe(1)
        ->and($pdfRequests())->toBe(3);

    $this->travel(61)->seconds();
    expect($preview($agent)['page_count'])->toBe(1);
});

it('renders a document with its compliance issues and needs a source', function () {
    $draft = draft(DocumentType::Invoice, [itemRow('Workshop', '10', '95')], ['customer_id' => null]);

    $preview = mcpJson(mcpTool(RenderTemplatePreviewTool::class, ['document_id' => $draft->id])->assertOk());

    expect(collect($preview['issues'])->pluck('path'))->toContain('document.customer')
        ->and($preview['totals']['gross'])->toBe('1130.50');
    mcpTool(RenderTemplatePreviewTool::class)->assertHasErrors(['- document_id: ', '- scenario: ']);
});
