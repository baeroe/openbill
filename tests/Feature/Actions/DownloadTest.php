<?php

use App\Actions\DocumentPdf;
use App\Actions\DocumentXml;
use App\Actions\FinalizeDocument;
use App\Enums\DocumentFileKind;
use App\Enums\DocumentType;
use App\Exceptions\ActionNotAllowedException;
use App\Exceptions\ArchiveCorruptedException;
use App\Models\Customer;
use App\Models\DocumentTypeSetting;
use App\Models\FieldDefinition;
use App\Models\TaxRate;
use App\Models\Template;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;

it('renders a draft PDF live with a watermark and archives nothing', function () {
    $document = draft();

    $file = app(DocumentPdf::class)->handle(systemActor(), $document);

    expect($file->filename)->toBe("draft-{$document->id}.pdf")
        ->and($file->mimeType)->toBe('application/pdf')
        ->and($file->contents)->toStartWith('%PDF-')
        ->and($document->files()->count())->toBe(0);
    Http::assertSent(fn (Request $request): bool => str_contains($request->body(), 'openbill-draft-mark') && ! str_contains($request->body(), 'name="pdfa"'));
});

it('delivers the archived PDF of a finalized document byte for byte after master data changed (review focus 3)', function () {
    $template = Template::factory()->create(['body' => '<h1>{{ document.number }} {{ customer.name }}</h1>']);
    FieldDefinition::factory()->create(['key' => 'project_name', 'label' => 'Project', 'doc_types' => ['invoice']]);
    $customer = Customer::factory()->create(['name' => 'Hafenkontor Lindqvist GmbH']);
    $done = app(FinalizeDocument::class)->handle(systemActor(), draft(DocumentType::Invoice, [itemRow()], ['customer_id' => $customer->id, 'template_id' => $template->id]));
    $archived = (string) Storage::disk('archive')->get($done->files()->sole()->path);

    $customer->forceFill(['name' => 'Renamed'])->save();
    $vat = vatRateId();
    TaxRate::query()->whereKey($vat)->update(['percent' => '25.00']);
    $template->forceFill(['body' => '<h1>changed</h1>'])->save();
    FieldDefinition::query()->update(['label' => 'Renamed']);

    $file = app(DocumentPdf::class)->handle(systemActor(), $done->fresh());

    expect($file->contents)->toBe($archived)
        ->and($file->filename)->toBe("{$done->number}.pdf");
    Http::assertSentCount(1);

    // a fresh render would differ (the fake PDF depends on the request): proves the download is not re-rendered
    // (the 19 % rate is 25 % now, so vatRateId() inside itemRow() would find none: pass it explicitly)
    expect(app(DocumentPdf::class)->handle(systemActor(), draft(DocumentType::Invoice, [itemRow(extra: ['tax_rate_id' => $vat])]))->contents)->not->toBe($archived);
});

it('refuses a tampered or missing archive file instead of rendering again', function () {
    $done = app(FinalizeDocument::class)->handle(systemActor(), draft());
    $path = $done->files()->sole()->path;

    Storage::disk('archive')->put($path, 'tampered');
    expect(fn () => app(DocumentPdf::class)->handle(systemActor(), $done->fresh()))->toThrow(ArchiveCorruptedException::class);

    Storage::disk('archive')->delete($path);
    expect(fn () => app(DocumentPdf::class)->handle(systemActor(), $done->fresh()))->toThrow(ArchiveCorruptedException::class);
    Http::assertSentCount(1);
});

it('delivers the archived XML of an e-invoice and refuses documents without one', function () {
    completeOrganization();
    DocumentTypeSetting::query()->whereKey('invoice')->update(['profile' => 'en16931']);
    $eInvoice = app(FinalizeDocument::class)->handle(systemActor(), draft(DocumentType::Invoice, [itemRow()], ['service_date' => now()->toDateString(), 'due_date' => now()->addDays(14)->toDateString()]));
    $offer = app(FinalizeDocument::class)->handle(systemActor(), draft(DocumentType::Offer));

    $xml = app(DocumentXml::class)->handle(systemActor(), $eInvoice);

    expect($xml->filename)->toBe("{$eInvoice->number}.xml")
        ->and($xml->mimeType)->toBe('application/xml')
        ->and($xml->contents)->toBe(Storage::disk('archive')->get($eInvoice->files()->where('kind', DocumentFileKind::Xml)->sole()->path));

    foreach ([$offer, draft()] as $document) {
        try {
            app(DocumentXml::class)->handle(systemActor(), $document);
            $this->fail('no exception');
        } catch (ActionNotAllowedException $e) {
            expect($e->reason)->toBe('no_e_invoice')->and($e->status())->toBe(409);
        }
    }
});
