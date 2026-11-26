<?php

use App\Actions\ConvertDocument;
use App\Actions\CreateDocument;
use App\Actions\DuplicateDocument;
use App\Actions\FinalizeDocument;
use App\Actions\LinkDocumentFiles;
use App\Actions\RenderPreview;
use App\Actions\SetDocumentStatus;
use App\Actions\UpdateDocumentType;
use App\Actions\UpdateDraft;
use App\Enums\DocumentStatus;
use App\Enums\DocumentType;
use App\Enums\EventAction;
use App\Exceptions\ComplianceFailedException;
use App\Models\Customer;
use App\Models\Document;
use App\Models\DocumentTypeSetting;
use App\Support\DocumentInspector;
use App\Support\IssueList;
use Illuminate\Validation\ValidationException;

function agb(array $input = []): Document
{
    $document = app(CreateDocument::class)->handle(systemActor(), ['type' => 'text', 'title' => 'Terms', 'body' => 'Terms text', 'slug' => 'agb', 'is_public' => true, ...$input]);

    return app(FinalizeDocument::class)->handle(systemActor(), $document);
}

function quoteWith(array $attachments): Document
{
    return draft(DocumentType::Offer, input: ['attachments' => $attachments]);
}

it('starts quotes and confirmations with the attachments of their document type and keeps them through duplicate and convert', function () {
    app(UpdateDocumentType::class)->handle(systemActor(), DocumentType::Offer, ['attachments' => ['agb']]);
    app(UpdateDocumentType::class)->handle(systemActor(), DocumentType::Confirmation, ['attachments' => ['agb', 'dsgvo']]);

    $offer = app(CreateDocument::class)->handle(systemActor(), ['type' => 'offer']);
    expect($offer->attachments)->toBe(['agb']);

    // a later change of the default does not touch existing drafts
    app(UpdateDocumentType::class)->handle(systemActor(), DocumentType::Offer, ['attachments' => ['other']]);
    expect($offer->fresh()->attachments)->toBe(['agb'])
        ->and(app(CreateDocument::class)->handle(systemActor(), ['type' => 'invoice'])->attachments)->toBeNull();

    expect(app(DuplicateDocument::class)->handle(systemActor(), $offer)->attachments)->toBe(['agb']);

    agb();
    $done = app(FinalizeDocument::class)->handle(systemActor(), draft(DocumentType::Offer, input: ['attachments' => ['agb']]));
    app(SetDocumentStatus::class)->handle(systemActor(), $done, DocumentStatus::Accepted);
    $confirmation = app(ConvertDocument::class)->handle(systemActor(), $done->fresh(), DocumentType::Confirmation)->document;
    expect($confirmation->attachments)->toBe(['agb'])
        ->and(app(ConvertDocument::class)->handle(systemActor(), $done->fresh(), DocumentType::Invoice)->document->attachments)->toBeNull();
});

it('rejects wrong attachment lists with 422', function (array $input) {
    $document = draft(DocumentType::Offer);

    expect(fn () => app(UpdateDraft::class)->handle(systemActor(), $document, $input))->toThrow(ValidationException::class);
})->with([
    'not a slug' => [['attachments' => ['AGB 1']]],
    'twice' => [['attachments' => ['agb', 'agb']]],
    'more than ten' => [['attachments' => ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k']]],
]);

it('allows attachments on quotes and confirmations only', function () {
    expect(fn () => app(UpdateDraft::class)->handle(systemActor(), draft(DocumentType::Invoice), ['attachments' => ['agb']]))->toThrow(ValidationException::class)
        ->and(fn () => app(UpdateDocumentType::class)->handle(systemActor(), DocumentType::Invoice, ['attachments' => ['agb']]))->toThrow(ValidationException::class);
    // an empty list is harmless
    app(UpdateDraft::class)->handle(systemActor(), draft(DocumentType::Invoice), ['attachments' => []]);
    app(UpdateDocumentType::class)->handle(systemActor(), DocumentType::Invoice, ['attachments' => null]);
});

it('reports attachment_missing live and blocks finalizing', function () {
    $offer = quoteWith(['agb', 'gone']);
    agb();

    $issues = IssueList::toArray(app(DocumentInspector::class)->issues($offer->fresh()));

    expect(collect($issues)->firstWhere('code', 'attachment_missing'))->toMatchArray(['path' => 'document.attachments.1']);
    expect(collect($issues)->where('code', 'attachment_missing'))->toHaveCount(1);
    expect(fn () => app(FinalizeDocument::class)->handle(systemActor(), $offer))->toThrow(ComplianceFailedException::class);
});

it('never resolves a text document with a customer', function () {
    agb(['customer_id' => Customer::factory()->create()->id, 'is_public' => false]);
    $offer = quoteWith(['agb']);

    expect(collect(IssueList::toArray(app(DocumentInspector::class)->issues($offer->fresh())))->pluck('code'))->toContain('attachment_missing');
    $this->withToken(apiToken())->getJson('/api/text-documents/slugs')->assertOk()->assertExactJson([]);
});

it('freezes the newest version when finalizing; a later version changes nothing', function () {
    $first = agb();
    $second = agb();
    $offer = quoteWith(['agb']);

    $done = app(FinalizeDocument::class)->handle(systemActor(), $offer);
    $frozen = $done->snapshot->data['attachments'];

    expect($frozen)->toHaveCount(1)
        ->and($frozen[0])->toMatchArray(['slug' => 'agb', 'document_id' => $second->id, 'number' => $second->number, 'title' => 'Terms', 'is_public' => true])
        ->and($frozen[0]['sha256'])->toBe($second->files()->where('kind', 'pdf')->value('sha256'))
        ->and($done->events()->where('action', EventAction::Finalized)->first()->payload['attachments'] ?? null)->toBe([$second->id]);

    $third = agb();
    $again = Document::query()->with('snapshot')->findOrFail($done->id);
    expect($again->snapshot->data['attachments'][0]['document_id'])->toBe($second->id)->not->toBe($third->id)->not->toBe($first->id);

    // the quote names the frozen version with number and link (preview of the finalized document)
    $body = app(RenderPreview::class)->handle(systemActor(), ['document_id' => $done->id])->toArray()['body'];
    expect($body)->toContain("Terms ({$second->number})")->toContain(url("/legal/agb/{$second->number}"))->not->toContain($third->number);
});

it('shows the live version of a draft in the preview, without link for a version that is not public', function () {
    agb(['is_public' => false]);
    $offer = quoteWith(['agb']);

    $body = app(RenderPreview::class)->handle(systemActor(), ['document_id' => $offer->id])->toArray()['body'];

    expect($body)->toContain('Terms (T-')->not->toContain('/legal/');
});

it('hands out signed links of the frozen attachments', function () {
    $text = agb();
    $done = app(FinalizeDocument::class)->handle(systemActor(), quoteWith(['agb']));
    agb();

    $links = app(LinkDocumentFiles::class)->handle(systemActor(), $done);

    expect($links['attachments'])->toHaveCount(1)
        ->and($links['attachments'][0])->toMatchArray(['title' => 'Terms', 'number' => $text->number])
        ->and($links['attachments'][0]['url'])->toContain("/api/downloads/documents/{$text->id}/pdf");
    $this->get($links['attachments'][0]['url'])->assertOk()->assertHeader('Content-Type', 'application/pdf');
    expect(app(LinkDocumentFiles::class)->handle(systemActor(), draft(DocumentType::Offer)))->not->toHaveKey('attachments');
});

it('shows attachments in the API: short names for drafts, frozen versions for finalized documents; and the type default', function () {
    $text = agb();
    $offer = quoteWith(['agb']);
    $this->withToken(apiToken());

    $this->getJson("/api/documents/{$offer->id}")->assertOk()->assertJsonPath('attachments', ['agb']);
    $done = app(FinalizeDocument::class)->handle(systemActor(), $offer);
    $this->getJson("/api/documents/{$done->id}")->assertOk()->assertJsonPath('attachments.0.document_id', $text->id)->assertJsonPath('attachments.0.number', $text->number);

    $this->patchJson('/api/document-types/offer', ['attachments' => ['agb']], ['Content-Type' => 'application/merge-patch+json'])->assertOk()->assertJsonPath('attachments', ['agb']);
    expect(DocumentTypeSetting::query()->findOrFail('offer')->attachments)->toBe(['agb']);
    $this->getJson('/api/text-documents/slugs')->assertOk()->assertJsonPath('0.slug', 'agb')->assertJsonPath('0.number', $text->number)
        ->assertJsonPath('0.public_url', url("/legal/agb/{$text->number}"));
});
