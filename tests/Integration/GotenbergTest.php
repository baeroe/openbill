<?php

use App\Actions\FinalizeDocument;
use App\Actions\RenderPreview;
use App\EInvoice\CiiBuilder;
use App\Enums\DocumentFileKind;
use App\Enums\DocumentStatus;
use App\Enums\DocumentType;
use App\Models\Document;
use App\Models\Template;
use App\Rendering\GotenbergClient;
use App\Rendering\Paper;
use App\Rendering\RenderResult;
use Database\Seeders\DemoSeeder;
use horstoeko\zugferd\ZugferdDocumentPdfReader;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;
use Smalot\PdfParser\Parser;

beforeEach(fn () => Storage::fake('archive'));

/** Text of every page, whitespace removed (pdfparser splits words of Chromium PDFs unpredictably). */
function pageTexts(string $pdf): array
{
    return array_map(fn ($page): string => (string) preg_replace('/\s+/', '', $page->getText()), (new Parser)->parseContent($pdf)->getPages());
}

it('talks to a Gotenberg that can embed Factur-X (8.34 or newer)', function () {
    $version = trim(Http::timeout(10)->get(config('services.gotenberg.url').'/version')->body());

    expect(version_compare(ltrim($version, 'v'), '8.34.0', '>='))->toBeTrue("Gotenberg {$version} is older than 8.34");
})->group('gotenberg');

it('renders each built-in template as a multi-page PDF with header and footer on every page', function (string $slug, Closure $pageMarker) {
    $preview = app(RenderPreview::class)->handle(systemActor(), [
        'template_id' => Template::query()->where('slug', $slug)->value('id'),
        'scenario' => 'long_invoice',
        'locale' => 'de',
    ]);
    expect($preview->render->errors)->toBe([]);

    $pages = pageTexts(app(GotenbergClient::class)->pdf($preview->render));
    $total = count($pages);

    expect($total)->toBeGreaterThan(1);
    foreach ($pages as $i => $text) {
        expect($text)->toContain('StudioNordlicht')
            ->and($text)->toContain($pageMarker($i + 1, $total));
    }
})->with([
    'klar' => ['klar', fn (int $page, int $total): string => "Seite{$page}von{$total}"],
    'kante' => ['kante', fn (int $page, int $total): string => "{$page}/{$total}"],
    'leise' => ['leise', fn (int $page, int $total): string => "{$page}/{$total}"],
])->group('gotenberg');

it('finalizes the demo invoice into a PDF/A-3b with the archived XML embedded', function () {
    $this->seed(DemoSeeder::class);
    $draft = Document::query()->where('type', DocumentType::Invoice)->where('status', DocumentStatus::Draft)->firstOrFail();

    $done = app(FinalizeDocument::class)->handle(systemActor(), $draft);

    $pdf = (string) Storage::disk('archive')->get($done->files()->where('kind', DocumentFileKind::Pdf)->sole()->path);
    $xml = (string) Storage::disk('archive')->get($done->files()->where('kind', DocumentFileKind::Xml)->sole()->path);
    // keyed by file name; json('invoice.pdf') would read the dot as a path separator
    $meta = Http::timeout(30)->attach('files', $pdf, 'invoice.pdf')
        ->post(config('services.gotenberg.url').'/forms/pdfengines/metadata/read')
        ->json()['invoice.pdf'] ?? [];

    expect(ZugferdDocumentPdfReader::getXmlFromContent($pdf))->toBe($xml)
        ->and(CiiBuilder::validate($xml))->toBe([])
        ->and($xml)->toContain((string) $done->number)
        ->and($meta['Part'] ?? null)->toBe(3)
        ->and($meta['Conformance'] ?? null)->toBe('B')
        ->and($meta['DocumentFileName'] ?? null)->toBe('factur-x.xml')
        ->and($meta['ConformanceLevel'] ?? null)->toBe('EN 16931')
        ->and(implode('', pageTexts($pdf)))->toContain(str_replace(' ', '', (string) $done->number));
})->group('gotenberg');

/** Probes for JavaScript and network access: a script that writes JSRAN, frames and images on internal hosts. */
function hostileBody(): string
{
    return '<p id="o">static</p><script>document.getElementById("o").textContent = "JSRAN";</script>'
        .'<iframe src="http://localhost:3000/health" width="600" height="200"></iframe>'
        .'<iframe src="http://web/" width="600" height="200"></iframe>'
        .'<object data="http://localhost:3000/health" width="600" height="200"></object>'
        .'<img src="http://localhost:3000/health?img=1" alt="IMGALT"><img src="https://example.com/pixel.png">';
}

function assertNothingLoaded(string $pdf): void
{
    $text = strtolower(implode('', pageTexts($pdf)));

    expect($text)->toContain('static')
        ->and($text)->not->toContain('jsran')        // no JavaScript
        ->and($text)->not->toContain('chromium')     // Gotenberg's own /health (JSON lists its modules)
        ->and($text)->not->toContain('password');    // the openbill login page on http://web/ (DDEV)
}

it('runs no JavaScript and loads no URL even for HTML without the CSP (Gotenberg flags, review #1)', function () {
    $result = new RenderResult('<html><body>H</body></html>', '<!doctype html><html><body>'.hostileBody().'</body></html>', '<html><body>F</body></html>', Paper::fromManifest([]));

    assertNothingLoaded(app(GotenbergClient::class)->pdf($result));
})->group('gotenberg');

it('blocks scripts and URLs of a template through its CSP (review #1)', function () {
    $preview = app(RenderPreview::class)->handle(systemActor(), [
        'scenario' => 'short_invoice',
        'template' => ['body' => hostileBody(), 'header' => hostileBody(), 'footer' => hostileBody()],
    ]);

    assertNothingLoaded(app(GotenbergClient::class)->pdf($preview->render));
})->group('gotenberg');
