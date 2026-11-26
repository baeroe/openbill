<?php

use App\Actions\CancelInvoice;
use App\Actions\ConvertDocument;
use App\Actions\CreateDocument;
use App\Actions\DeleteDraft;
use App\Actions\DuplicateDocument;
use App\Actions\FinalizeDocument;
use App\Actions\SuggestPositions;
use App\Actions\UpdateDraft;
use App\Domain\Lifecycle\StatusMachine;
use App\Enums\DocumentStatus;
use App\Enums\DocumentType;
use App\Exceptions\ActionNotAllowedException;
use App\Exceptions\ComplianceFailedException;
use App\Exceptions\DocumentLockedException;
use App\Models\Customer;
use App\Models\Document;
use App\Support\DocumentInspector;
use App\Support\DocumentQuery;
use App\Support\IssueList;
use App\Support\Overview;
use Carbon\CarbonImmutable;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

function textDraft(array $input = []): Document
{
    return app(CreateDocument::class)->handle(systemActor(), [
        'type' => 'text',
        'title' => 'Allgemeine Geschäftsbedingungen',
        'body' => "# § 1 Geltung\n\nDiese AGB gelten für alle Verträge.",
        'slug' => 'agb',
        ...$input,
    ]);
}

it('creates a text document without customer and positions', function () {
    $document = textDraft();

    expect($document->type)->toBe(DocumentType::Text)
        ->and($document->customer_id)->toBeNull()
        ->and($document->title)->toBe('Allgemeine Geschäftsbedingungen')
        ->and($document->slug)->toBe('agb')
        ->and($document->is_public)->toBeFalse()
        ->and($document->gross_total)->toBe('0.00')
        ->and(app(DocumentInspector::class)->issues($document))->toBe([]);
});

it('rejects wrongly formatted fields with 422', function (array $input, string $path) {
    $document = textDraft();

    expect(fn () => app(UpdateDraft::class)->handle(systemActor(), $document, $input))
        ->toThrow(fn (ValidationException $e) => expect($e->errors())->toHaveKey($path));
})->with([
    'slug pattern' => [['slug' => 'AGB 1'], 'slug'],
    'slug too long' => [['slug' => str_repeat('a', 65)], 'slug'],
    'body too long' => [['body' => str_repeat('a', 100001)], 'body'],
    'public without slug' => [['slug' => null, 'is_public' => true], 'is_public'],
    'positions' => [['groups' => [['title' => 'Heading', 'positions' => []]]], 'groups.0'],
]);

it('refuses text fields on other types', function () {
    $invoice = draft();

    expect(fn () => app(UpdateDraft::class)->handle(systemActor(), $invoice, ['title' => 'x']))->toThrow(ValidationException::class);
    // empty values are harmless
    app(UpdateDraft::class)->handle(systemActor(), $invoice, ['title' => null, 'is_public' => false]);
});

it('keeps text documents out of the money figures', function () {
    app(FinalizeDocument::class)->handle(systemActor(), textDraft());
    $today = CarbonImmutable::now();

    expect(DocumentQuery::summary([], $today->toDateString()))->toBe(['count' => 1, 'gross_total' => '0.00'])
        ->and(DocumentQuery::summary(['type' => 'text'], $today->toDateString()))->toBe(['count' => 1, 'gross_total' => '0.00'])
        ->and(DocumentQuery::counts([], $today->toDateString())['text'])->toBe(1)
        ->and(Overview::build($today)['figures']['open'])->toBe(['gross' => '0.00', 'count' => 0])
        ->and(Overview::build($today)['attention_count'])->toBe(0);

    textDraft();
    expect(Overview::build($today)['attention_count'])->toBe(0);
});

it('reports issues while typing: missing title and text, public with customer', function () {
    $customer = Customer::factory()->create();
    $document = textDraft(['title' => '', 'body' => '  ', 'customer_id' => $customer->id, 'is_public' => true]);

    $issues = IssueList::toArray(app(DocumentInspector::class)->issues($document));

    expect(array_column($issues, 'path'))->toEqualCanonicalizing(['document.title', 'document.body', 'document.is_public'])
        ->and(array_column($issues, 'code'))->toContain('public_with_customer');
    expect(fn () => app(FinalizeDocument::class)->handle(systemActor(), $document))->toThrow(ComplianceFailedException::class);
});

it('finalizes with a T number, status closed, snapshot and archive', function () {
    $done = app(FinalizeDocument::class)->handle(systemActor(), textDraft(['is_public' => true]));

    expect($done->number)->toBe('T-'.now()->format('Y').'-0001')
        ->and($done->status)->toBe(DocumentStatus::Closed)
        ->and($done->snapshot->data)->toMatchArray(['title' => 'Allgemeine Geschäftsbedingungen', 'slug' => 'agb', 'is_public' => true])
        ->and($done->snapshot->data['body'])->toContain('§ 1 Geltung')
        ->and($done->files()->count())->toBeGreaterThan(0)
        ->and(StatusMachine::nextStatuses(DocumentType::Text, DocumentStatus::Closed))->toBe([]);
});

it('locks title, body, slug and public flag after finalizing (hook and trigger)', function () {
    $done = app(FinalizeDocument::class)->handle(systemActor(), textDraft());

    foreach (['title' => 'x', 'body' => 'x', 'slug' => 'x', 'is_public' => true] as $column => $value) {
        $fresh = Document::query()->findOrFail($done->id);
        $fresh->{$column} = $value;
        expect(fn () => $fresh->save())->toThrow(DocumentLockedException::class);
        expect(fn () => DB::table('documents')->where('id', $done->id)->update([$column => $value]))->toThrow(QueryException::class);
    }
});

it('duplicates into a new version with the text fields', function () {
    $done = app(FinalizeDocument::class)->handle(systemActor(), textDraft(['is_public' => true]));

    $copy = app(DuplicateDocument::class)->handle(systemActor(), $done);

    expect($copy->status)->toBe(DocumentStatus::Draft)
        ->and($copy->number)->toBeNull()
        ->and($copy->only(['title', 'body', 'slug', 'is_public']))->toBe($done->only(['title', 'body', 'slug', 'is_public']));
});

it('deletes a draft', function () {
    $document = textDraft();

    app(DeleteDraft::class)->handle(systemActor(), $document);

    expect(Document::query()->find($document->id))->toBeNull();
});

it('refuses to convert or cancel a text document and to convert into one', function () {
    $done = app(FinalizeDocument::class)->handle(systemActor(), textDraft());

    foreach ([DocumentType::Invoice, DocumentType::Offer, DocumentType::Text] as $target) {
        expect(fn () => app(ConvertDocument::class)->handle(systemActor(), $done, $target))->toThrow(ActionNotAllowedException::class);
    }
    expect(fn () => app(CancelInvoice::class)->handle(systemActor(), $done))->toThrow(ActionNotAllowedException::class);
    $offer = app(FinalizeDocument::class)->handle(systemActor(), draft(DocumentType::Offer));
    $offer->forceFill(['status' => DocumentStatus::Accepted])->save();
    expect(fn () => app(ConvertDocument::class)->handle(systemActor(), $offer, DocumentType::Text))->toThrow(ActionNotAllowedException::class);
});

it('does not suggest positions from text documents and lists them by type', function () {
    textDraft();

    expect(app(SuggestPositions::class)->handle(systemActor(), []))->toBe([])
        ->and(DocumentQuery::filtered(['type' => 'text'], now()->toDateString())->count())->toBe(1);
});
