<?php

use App\Actions\FinalizeDocument;
use App\Contracts\DocumentArchiver;
use App\EInvoice\CiiBuilder;
use App\Enums\DocumentFileKind;
use App\Enums\DocumentStatus;
use App\Enums\DocumentType;
use App\Enums\RenderPart;
use App\Exceptions\PdfRenderFailedException;
use App\Exceptions\TemplateRenderFailedException;
use App\Models\Document;
use App\Models\DocumentFile;
use App\Models\DocumentSnapshot;
use App\Models\DocumentTypeSetting;
use App\Models\NumberSequence;
use App\Models\Template;
use App\Rendering\PdfDocumentArchiver;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;
use Tests\Support\GotenbergFake;

function invoiceNumberCounter(): int
{
    return (int) NumberSequence::query()->where('doc_type', 'invoice')->where('year', (int) now()->format('Y'))->value('next_value');
}

function eInvoiceDraft(): Document
{
    completeOrganization();
    DocumentTypeSetting::query()->whereIn('type', ['invoice', 'cancellation'])->update(['profile' => 'en16931']);

    return draft(DocumentType::Invoice, [itemRow('Workshop', '10', '95')], ['service_date' => now()->toDateString(), 'due_date' => now()->addDays(14)->toDateString()]);
}

function assertNothingArchived(Document $document): void
{
    expect($document->fresh()->status)->toBe(DocumentStatus::Draft)
        ->and($document->fresh()->number)->toBeNull()
        ->and($document->fresh()->finalized_at)->toBeNull()
        ->and(DocumentFile::query()->count())->toBe(0)
        ->and(Storage::disk('archive')->allFiles())->toBe([])
        ->and(invoiceNumberCounter())->toBe(0);
}

it('archives the PDF under {year}/{id}.pdf with its SHA-256 and leaves no temporary file', function () {
    $document = draft(DocumentType::Invoice, [itemRow('Workshop', '10', '95')]);

    $done = app(FinalizeDocument::class)->handle(systemActor(), $document);

    $file = $done->files()->sole();
    $path = $done->date->format('Y')."/{$done->id}.pdf";
    expect($file->kind)->toBe(DocumentFileKind::Pdf)
        ->and($file->path)->toBe($path)
        ->and($file->sha256)->toBe(hash('sha256', (string) Storage::disk('archive')->get($path)))
        ->and($file->size)->toBe(strlen((string) Storage::disk('archive')->get($path)))
        ->and(Storage::disk('archive')->files('.tmp'))->toBe([]);
    Http::assertSent(fn (Request $request): bool => str_contains($request->body(), 'INV-'.now()->format('Y').'-0001')
        && ! str_contains($request->body(), 'name="pdfa"')
        && ! str_contains($request->body(), 'openbill-draft-mark'));
});

it('embeds and archives the e-invoice XML for the EN 16931 profile', function () {
    $done = app(FinalizeDocument::class)->handle(systemActor(), eInvoiceDraft());

    $xml = $done->files()->where('kind', DocumentFileKind::Xml)->sole();
    $contents = (string) Storage::disk('archive')->get($xml->path);
    expect($done->files()->count())->toBe(2)
        ->and($xml->path)->toBe($done->date->format('Y')."/{$done->id}.xml")
        ->and(CiiBuilder::validate($contents))->toBe([])
        ->and($contents)->toContain($done->number);
    Http::assertSent(fn (Request $request): bool => str_contains($request->body(), 'PDF/A-3b')
        && str_contains($request->body(), 'filename="factur-x.xml"')
        && str_contains($request->body(), $done->number));
});

it('rolls everything back when Gotenberg fails, so the number stays free (review focus 1)', function (Closure $failure) {
    $document = eInvoiceDraft();
    $failure();

    expect(fn () => app(FinalizeDocument::class)->handle(systemActor(), $document))->toThrow(PdfRenderFailedException::class);
    assertNothingArchived($document);

    GotenbergFake::succeed();
    expect(app(FinalizeDocument::class)->handle(systemActor(), $document->fresh())->number)->toBe('INV-'.now()->format('Y').'-0001');
})->with([
    'error answer' => [fn () => GotenbergFake::failWithError()],
    'timeout' => [fn () => GotenbergFake::timeOut()],
]);

it('refuses to finalize with a broken template and reports part and line (review focus 2)', function () {
    $template = Template::factory()->create(['body' => "<h1>{{ document.number }}</h1>\n{% if %}"]);
    $document = draft(DocumentType::Invoice, [itemRow()], ['template_id' => $template->id]);

    try {
        app(FinalizeDocument::class)->handle(systemActor(), $document);
        $this->fail('no exception');
    } catch (TemplateRenderFailedException $e) {
        expect($e->status())->toBe(422)
            ->and($e->errors[0]->part)->toBe(RenderPart::Body)
            ->and($e->errors[0]->line)->toBe(2)
            ->and($e->toArray()[0]['file'])->toBe('template.liquid');
    }

    assertNothingArchived($document);
    Http::assertNothingSent();
});

it('freezes the effective template in the snapshot when the document has none', function () {
    $document = draft();
    $document->forceFill(['template_id' => null])->save();

    $done = app(FinalizeDocument::class)->handle(systemActor(), $document);

    expect($done->snapshot->data['template']['slug'])->toBe('klar');
});

it('deletes files already moved into the archive when a later step fails (review #10)', function () {
    $document = eInvoiceDraft();
    // the PDF and the XML are in place when the archiver (or anything after it) throws
    app()->bind(DocumentArchiver::class, fn () => new class(app(PdfDocumentArchiver::class)) implements DocumentArchiver
    {
        public function __construct(private readonly PdfDocumentArchiver $inner) {}

        public function archive(Document $document, DocumentSnapshot $snapshot): void
        {
            $this->inner->archive($document, $snapshot);
            throw new RuntimeException('after store');
        }
    });

    expect(fn () => app(FinalizeDocument::class)->handle(systemActor(), $document))->toThrow(RuntimeException::class, 'after store');
    assertNothingArchived($document);
});
