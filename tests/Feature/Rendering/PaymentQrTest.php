<?php

use App\Actions\CancelInvoice;
use App\Actions\FinalizeDocument;
use App\Actions\SetDocumentStatus;
use App\Contracts\DocumentArchiver;
use App\Domain\Payment\EpcPayload;
use App\Enums\DocumentStatus;
use App\Enums\DocumentType;
use App\Enums\RenderScenario;
use App\Models\Document;
use App\Models\Organization;
use App\Rendering\ContextBuilder;
use App\Rendering\LiquidRenderer;
use App\Rendering\PaymentQr;
use App\Rendering\SampleDataFactory;
use App\Rendering\TemplateSource;
use App\Support\DocumentInspector;
use App\Support\NullDocumentArchiver;
use Brick\Math\BigDecimal;
use chillerlan\QRCode\Output\QROutputInterface;
use chillerlan\QRCode\QRCode;
use chillerlan\QRCode\QROptions;

beforeEach(function () {
    app()->bind(DocumentArchiver::class, NullDocumentArchiver::class);
    completeOrganization();
    Organization::current()->forceFill(['bic' => 'BYLADEM1001'])->save();
});

function qrOf(Document $document): string
{
    $document->loadMissing('groups.positions');

    return app(ContextBuilder::class)->build($document, app(DocumentInspector::class)->sources($document))->data['document']['payment_qr'];
}

function finalizedForQr(DocumentType $type, array $positions = []): Document
{
    return app(FinalizeDocument::class)->handle(systemActor(), draft($type, $positions))->fresh();
}

/** Payload read back from a PNG made with the same QR settings as the SVG. */
function decodedPayload(string $payload): string
{
    $png = (new QRCode(new QROptions([...PaymentQr::OPTIONS, 'outputType' => QROutputInterface::GDIMAGE_PNG, 'outputBase64' => false, 'scale' => 8])))
        ->addByteSegment($payload)->render();

    return (new QRCode(new QROptions))->readFromBlob($png)->data;
}

it('fills the GiroCode of a finalized invoice as base64 SVG data URL', function () {
    $invoice = finalizedForQr(DocumentType::Invoice);
    $qr = qrOf($invoice);

    expect($qr)->toStartWith('data:image/svg+xml;base64,')
        ->and($qr)->toMatch('#^data:image/svg\+xml;base64,[A-Za-z0-9+/=]+$#')
        ->and(base64_decode(substr($qr, strlen('data:image/svg+xml;base64,'))))->toStartWith('<svg ')
        ->and($qr)->toBe(PaymentQr::dataUrl((string) EpcPayload::build('Studio Nordlicht', 'DE02120300000000202051', 'BYLADEM1001', BigDecimal::of((string) $invoice->gross_total), $invoice->number)));
});

it('keeps the GiroCode of a paid invoice and reads the bank account from the snapshot', function () {
    $invoice = finalizedForQr(DocumentType::Invoice);
    $before = qrOf($invoice);
    Organization::current()->forceFill(['iban' => 'DE89370400440532013000', 'name' => 'Renamed'])->save();
    app(SetDocumentStatus::class)->handle(systemActor(), $invoice, DocumentStatus::Paid);

    expect(qrOf($invoice->fresh()))->toBe($before);
});

it('is empty for drafts, offers, cancellations, zero totals and without IBAN', function (Document $document) {
    expect(qrOf($document))->toBe('');
})->with([
    'draft' => fn () => draft(DocumentType::Invoice),
    'offer' => fn () => finalizedForQr(DocumentType::Offer),
    'cancellation' => fn () => app(FinalizeDocument::class)->handle(systemActor(), app(CancelInvoice::class)->handle(systemActor(), finalizedForQr(DocumentType::Invoice))->document)->fresh(),
    'zero total' => fn () => finalizedForQr(DocumentType::Invoice, [itemRow('Kulanz', '1', '0')]),
    'no IBAN' => function () {
        Organization::current()->forceFill(['iban' => ''])->save();

        return finalizedForQr(DocumentType::Invoice);
    },
]);

it('decodes back to the EPC payload, umlauts included', function () {
    $payload = (string) EpcPayload::build('Bäckerei Größenwahn & Söhne', 'DE02120300000000202051', 'BYLADEM1001', BigDecimal::of('1189.41'), 'RE-2026-0042');

    expect(decodedPayload($payload))->toBe($payload);
});

it('gives every invoice sample scenario a GiroCode, the offer none', function (RenderScenario $scenario) {
    $sample = app(SampleDataFactory::class)->make($scenario, 'de');
    $qr = app(ContextBuilder::class)->build($sample->document, $sample->sources)->data['document']['payment_qr'];

    expect($qr !== '')->toBe($scenario !== RenderScenario::OfferWithOptions);
})->with(RenderScenario::cases());

it('survives HTML escaping unchanged and prints into an img', function () {
    $sample = app(SampleDataFactory::class)->make(RenderScenario::ShortInvoice, 'de');
    $context = app(ContextBuilder::class)->build($sample->document, $sample->sources)->data;
    $template = new TemplateSource(body: '<img src="{{ document.payment_qr }}">{{ org.iban | iban }}', header: '', footer: '', css: '', manifest: [], assets: []);

    $body = app(LiquidRenderer::class)->render($template, $context)->body;

    expect($body)->toContain('<img src="'.$context['document']['payment_qr'].'">');
});
