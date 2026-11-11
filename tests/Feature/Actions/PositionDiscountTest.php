<?php

use App\Actions\CancelInvoice;
use App\Actions\ConvertDocument;
use App\Actions\DuplicateDocument;
use App\Actions\FinalizeDocument;
use App\Actions\RenderPreview;
use App\Actions\SetDocumentStatus;
use App\Actions\UpdateDraft;
use App\Enums\DiscountType;
use App\Enums\DocumentStatus;
use App\Enums\DocumentType;
use App\Exceptions\ComplianceFailedException;
use App\Exceptions\DocumentLockedException;
use App\Models\Document;
use App\Models\Position;
use App\Rendering\ContextBuilder;
use App\Support\DocumentInspector;
use Illuminate\Database\QueryException;
use Illuminate\Validation\ValidationException;

/** @return array<string, mixed> */
function percentOff(string $value): array
{
    return ['discount_type' => 'percent', 'discount_value' => $value];
}

/** @return array<string, mixed> */
function amountOff(string $value): array
{
    return ['discount_type' => 'amount', 'discount_value' => $value];
}

function finalizeDiscounted(Document $document): Document
{
    return app(FinalizeDocument::class)->handle(systemActor(), $document);
}

/**
 * Validation errors of UpdateDraft for the given positions.
 *
 * @param  list<array<string, mixed>>  $positions
 * @return array<string, list<string>>
 */
function discountErrors(Document $document, array $positions): array
{
    try {
        app(UpdateDraft::class)->handle(systemActor(), $document, ['groups' => [['title' => null, 'positions' => $positions]]]);
    } catch (ValidationException $e) {
        return $e->errors();
    }

    return [];
}

it('stores a discount per position and computes the line, document and stored totals from it', function () {
    $document = draft(DocumentType::Invoice, [
        itemRow('Workshop', '2', '85', percentOff('10')),
        itemRow('Lizenz', '5', '80', amountOff('50')),
        itemRow('Beratung', '1', '100'),
    ]);

    $positions = $document->groups[0]->positions;
    $totals = app(DocumentInspector::class)->totals($document)->toArray();

    expect($positions[0]->discount_type)->toBe(DiscountType::Percent)
        ->and($positions[0]->discount_value)->toBe('10.00')
        ->and($positions[1]->discount_type)->toBe(DiscountType::Amount)
        ->and($positions[1]->discount_value)->toBe('50.00')
        ->and($positions[2]->discount_type)->toBeNull()
        ->and($positions[2]->discount_value)->toBeNull()
        ->and($totals['lines'][$positions[0]->id])->toMatchArray(['net' => '153.00', 'before_discount' => '170.00', 'discount' => '17.00'])
        ->and($totals['lines'][$positions[1]->id])->toMatchArray(['net' => '350.00', 'before_discount' => '400.00', 'discount' => '50.00'])
        ->and($document->net_total)->toBe('603.00')
        ->and($document->gross_total)->toBe('717.57');
});

it('drops the discount of text lines and a value without a type', function () {
    $document = draft(DocumentType::Invoice, [
        itemRow('Workshop', '1', '100', ['discount_value' => '10']),
        ['kind' => 'text', 'title' => 'Hinweis', 'quantity' => '0', 'unit_price' => '0', 'unit_id' => null, 'tax_rate_id' => null, 'custom' => [], ...percentOff('10')],
        itemRow('Lizenz', '1', '100', ['discount_type' => null, 'discount_value' => '5']),
    ]);

    expect($document->groups[0]->positions->map(fn (Position $p): array => [$p->discount_type, $p->discount_value])->all())->toBe([[null, null], [null, null], [null, null]])
        ->and($document->net_total)->toBe('200.00');
});

it('rejects discounts outside their range with the field path and saves nothing', function (array $discount, string $message) {
    $document = draft(DocumentType::Invoice, [itemRow('Workshop', '1', '100')]);
    $before = $document->fresh(['groups.positions'])->groups[0]->positions[0]->toArray();

    $errors = discountErrors($document, [itemRow('Workshop', '1', '100', $discount)]);

    expect(array_keys($errors))->toBe([array_key_first($errors)])
        ->and(array_key_first($errors))->toBeIn(['groups.0.positions.0.discount_value', 'groups.0.positions.0.discount_type'])
        ->and($errors[array_key_first($errors)][0])->toContain($message)
        ->and($document->fresh(['groups.positions'])->groups[0]->positions[0]->toArray())->toBe($before);
})->with([
    'percent above 100' => [percentOff('100.01'), 'between 0 and 100'],
    'negative percent' => [percentOff('-5'), 'must not be negative'],
    'negative amount' => [amountOff('-1'), 'must not be negative'],
    'three decimals' => [amountOff('1.005'), '2 decimals'],
    'float' => [['discount_type' => 'amount', 'discount_value' => 12.5], '2 decimals'],
    'type without value' => [['discount_type' => 'amount'], 'Enter the discount'],
    'unknown type' => [['discount_type' => 'fixed', 'discount_value' => '5'], 'invalid'],
]);

it('accepts 0 and 100 percent and an amount of the whole line', function () {
    $document = draft(DocumentType::Invoice, [
        itemRow('Workshop', '1', '100', percentOff('0')),
        itemRow('Onboarding', '1', '250', percentOff('100')),
        itemRow('Lizenz', '2', '49.95', amountOff('99.90')),
    ]);

    expect($document->net_total)->toBe('100.00')
        ->and(app(DocumentInspector::class)->issues($document))->toBe([]);
});

it('reports a fixed discount above the line amount as an issue that blocks finalizing', function () {
    $document = draft(DocumentType::Invoice, [itemRow('Workshop', '1', '100', amountOff('120'))]);
    $position = $document->groups[0]->positions[0];

    $issues = app(DocumentInspector::class)->issues($document);
    expect(collect($issues)->map(fn ($issue): string => $issue->path.' '.$issue->rule->value)->all())->toContain("positions.{$position->id}.discount discount_exceeds_line")
        ->and(fn () => finalizeDiscounted($document))->toThrow(ComplianceFailedException::class)
        ->and($document->fresh()->number)->toBeNull();

    // the quantity grows: the same discount fits again
    $grown = app(UpdateDraft::class)->handle(systemActor(), $document, ['groups' => [['title' => null, 'positions' => [itemRow('Workshop', '2', '100', [...amountOff('120'), 'id' => $position->id])]]]]);
    expect(app(DocumentInspector::class)->issues($grown))->toBe([])
        ->and($grown->net_total)->toBe('80.00');
});

it('freezes the discount with the finalized document', function () {
    $invoice = finalizeDiscounted(draft(DocumentType::Invoice, [itemRow('Workshop', '2', '85', percentOff('10'))]));
    $position = $invoice->groups[0]->positions[0];

    expect($invoice->status)->toBe(DocumentStatus::Open)
        ->and($invoice->gross_total)->toBe('182.07')
        ->and(app(DocumentInspector::class)->totals($invoice->fresh())->toArray()['lines'][$position->id]['discount'])->toBe('17.00')
        ->and(fn () => $position->forceFill(['discount_value' => '20'])->save())->toThrow(DocumentLockedException::class)
        ->and(fn () => Position::query()->whereKey($position->id)->update(['discount_value' => '20']))->toThrow(QueryException::class)
        ->and($position->fresh()->discount_value)->toBe('10.00');
});

it('keeps the discount when an offer becomes an invoice and when a document is duplicated', function () {
    $offer = finalizeDiscounted(draft(DocumentType::Offer, [itemRow('Workshop', '2', '85', percentOff('10')), itemRow('Lizenz', '5', '80', amountOff('50'))]));
    $offer = app(SetDocumentStatus::class)->handle(systemActor(), $offer, DocumentStatus::Accepted);

    $invoice = app(ConvertDocument::class)->handle(systemActor(), $offer, DocumentType::Invoice)->document;
    $copy = app(DuplicateDocument::class)->handle(systemActor(), $offer);

    foreach ([$invoice, $copy] as $document) {
        expect($document->groups[0]->positions->map(fn (Position $p): array => [$p->discount_type?->value, $p->discount_value])->all())->toBe([['percent', '10.00'], ['amount', '50.00']])
            ->and($document->net_total)->toBe('503.00')
            ->and($document->gross_total)->toBe($offer->gross_total);
    }
});

it('mirrors the discount in a cancellation, which credits exactly the invoice', function () {
    $invoice = finalizeDiscounted(draft(DocumentType::Invoice, [itemRow('Workshop', '2', '85', percentOff('10')), itemRow('Lizenz', '5', '80', amountOff('50'))]));

    $cancellation = app(CancelInvoice::class)->handle(systemActor(), $invoice)->document;
    $position = $cancellation->groups[0]->positions[1];

    expect($position->quantity)->toBe('-5.0000')
        ->and([$position->discount_type, $position->discount_value])->toBe([DiscountType::Amount, '50.00'])
        ->and($cancellation->gross_total)->toBe('-598.57')
        ->and($invoice->gross_total)->toBe('598.57')
        ->and(app(DocumentInspector::class)->issues($cancellation))->toBe([]);

    finalizeDiscounted($cancellation);
    expect($invoice->fresh()->status)->toBe(DocumentStatus::Cancelled);
});

it('previews an unsaved discount with its totals and without saving it', function () {
    $document = draft(DocumentType::Invoice, [itemRow('Workshop', '10', '95')]);

    $result = app(RenderPreview::class)->handle(systemActor(), [
        'document_id' => $document->id,
        'draft' => ['groups' => [['title' => null, 'positions' => [itemRow('Workshop', '10', '95', percentOff('20'))]]]],
    ])->toArray();

    expect($result['totals']['net'])->toBe('760.00')
        ->and(collect($result['totals']['lines'])->first())->toMatchArray(['before_discount' => '950.00', 'discount' => '190.00'])
        ->and($result['body'])->toContain('−20 %')
        ->and($document->fresh(['groups.positions'])->groups[0]->positions[0]->discount_type)->toBeNull();

    expect(fn () => app(RenderPreview::class)->handle(systemActor(), [
        'document_id' => $document->id,
        'draft' => ['groups' => [['title' => null, 'positions' => [itemRow('Workshop', '10', '95', percentOff('120'))]]]],
    ]))->toThrow(ValidationException::class);
});

it('gives templates the discount of a saved document', function () {
    $document = draft(DocumentType::Invoice, [itemRow('Workshop', '2', '85', percentOff('12.5')), itemRow('Lizenz', '5', '80', amountOff('50')), itemRow('Beratung', '1', '100')]);
    $sources = app(DocumentInspector::class)->sources($document);

    $positions = app(ContextBuilder::class)->build($document, $sources)->data['positions'];

    expect($positions[0])->toMatchArray(['has_discount' => true, 'discount_type' => 'percent', 'discount_value' => '12.5', 'discount_amount' => '21.25', 'total_before_discount' => '170.00', 'total' => '148.75'])
        ->and($positions[1])->toMatchArray(['has_discount' => true, 'discount_type' => 'amount', 'discount_value' => '50.00', 'discount_amount' => '50.00', 'total_before_discount' => '400.00', 'total' => '350.00'])
        ->and($positions[2])->toMatchArray(['has_discount' => false, 'discount_type' => '', 'discount_value' => '', 'discount_amount' => '0.00', 'total_before_discount' => '100.00', 'total' => '100.00']);
});
