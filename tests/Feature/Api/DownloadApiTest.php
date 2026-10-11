<?php

use App\Actions\FinalizeDocument;
use App\Enums\DocumentFileKind;
use App\Enums\DocumentType;
use App\Models\DocumentTypeSetting;
use App\Support\SignedDownloads;
use Illuminate\Support\Facades\Storage;

it('downloads a draft PDF live and a finalized PDF byte for byte from the archive', function () {
    $this->withToken(apiToken(['api:read']));
    $draft = draft();

    $this->get("/api/documents/{$draft->id}/pdf")
        ->assertOk()
        ->assertHeader('Content-Type', 'application/pdf')
        ->assertHeader('Content-Disposition', "attachment; filename=draft-{$draft->id}.pdf");

    $done = app(FinalizeDocument::class)->handle(systemActor(), $draft);
    $archived = Storage::disk('archive')->get($done->files()->where('kind', DocumentFileKind::Pdf)->sole()->path);

    expect($this->get("/api/documents/{$done->id}/pdf")->assertOk()->getContent())->toBe($archived);
    $this->get("/api/documents/{$done->id}/pdf?inline=1")
        ->assertHeader('Content-Disposition', "inline; filename={$done->number}.pdf");
});

it('downloads the e-invoice XML and refuses it for documents without one', function () {
    $this->withToken(apiToken(['api:read']));
    $plain = app(FinalizeDocument::class)->handle(systemActor(), draft());
    $this->get("/api/documents/{$plain->id}/xml", ['Accept' => 'application/json'])
        ->assertStatus(409)
        ->assertJsonPath('reason', 'no_e_invoice');

    completeOrganization();
    DocumentTypeSetting::query()->whereIn('type', ['invoice', 'cancellation'])->update(['profile' => 'en16931']);
    $eInvoice = app(FinalizeDocument::class)->handle(systemActor(), draft(DocumentType::Invoice, [itemRow('Workshop', '10', '95')], [
        'service_date' => now()->toDateString(), 'due_date' => now()->addDays(14)->toDateString(),
    ]));

    $response = $this->get("/api/documents/{$eInvoice->id}/xml")
        ->assertOk()
        ->assertHeader('Content-Type', 'application/xml');
    expect($response->getContent())->toContain((string) $eInvoice->number);
});

it('hands out signed 15-minute links that work without a token', function () {
    $this->freezeTime();
    $done = app(FinalizeDocument::class)->handle(systemActor(), draft());

    $link = app(SignedDownloads::class)->link($done, DocumentFileKind::Pdf);

    expect($link['expires_at'])->toBe(now()->addMinutes(15)->toAtomString())
        ->and($link['url'])->toContain("/api/downloads/documents/{$done->id}/pdf?expires=");
    $this->get($link['url'])->assertOk()->assertHeader('Content-Type', 'application/pdf');
    $this->get(str_replace($done->id, draft()->id, $link['url']), ['Accept' => 'application/json'])
        ->assertForbidden()
        ->assertJsonPath('reason', 'forbidden');

    $this->travel(16)->minutes();
    $this->get($link['url'], ['Accept' => 'application/json'])->assertForbidden();
});

it('answers a signed XML link of a document without e-invoice with 409', function () {
    $done = app(FinalizeDocument::class)->handle(systemActor(), draft());

    $this->get(app(SignedDownloads::class)->link($done, DocumentFileKind::Xml)['url'], ['Accept' => 'application/json'])
        ->assertStatus(409)
        ->assertJsonPath('reason', 'no_e_invoice');
});

it('needs a token with read access for the direct download', function () {
    $draft = draft();

    $this->get("/api/documents/{$draft->id}/pdf", ['Accept' => 'application/json'])->assertUnauthorized();
    $this->withToken(apiToken(['templates:render']))->get("/api/documents/{$draft->id}/pdf", ['Accept' => 'application/json'])->assertForbidden();
});
