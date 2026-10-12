<?php

use App\Actions\CreateDocument;
use App\Actions\DeleteDraft;
use App\Actions\UpdateDraft;
use App\Enums\DocumentStatus;
use App\Enums\DocumentType;
use App\Enums\EventAction;
use App\Enums\FieldScope;
use App\Enums\FieldType;
use App\Enums\PositionKind;
use App\Enums\TextBlockKind;
use App\Exceptions\ActionNotAllowedException;
use App\Exceptions\DocumentLockedException;
use App\Models\Contact;
use App\Models\Customer;
use App\Models\Document;
use App\Models\DocumentEvent;
use App\Models\DocumentTypeSetting;
use App\Models\FieldDefinition;
use App\Models\Template;
use App\Models\TextBlock;
use App\Models\User;
use App\Support\Actor;
use Illuminate\Validation\ValidationException;

/** @return array<string, list<string>> */
function draftErrors(Closure $run): array
{
    try {
        $run();
    } catch (ValidationException $e) {
        return $e->errors();
    }

    return [];
}

it('creates a draft with the defaults of its document type', function () {
    $intro = TextBlock::factory()->create(['kind' => TextBlockKind::Intro, 'body' => 'Thank you for the good cooperation.']);
    $template = Template::factory()->create();
    DocumentTypeSetting::query()->whereKey('invoice')->update(['default_intro_block_id' => $intro->id, 'template_id' => $template->id]);
    FieldDefinition::factory()->create(['key' => 'project_name', 'default_value' => 'Relaunch', 'doc_types' => ['invoice']]);
    FieldDefinition::factory()->create(['key' => 'offer_note', 'default_value' => 'only offers', 'doc_types' => ['offer']]);
    $customer = Customer::factory()->create(['locale' => 'de']);
    $contact = Contact::factory()->for($customer)->create(['is_default' => true]);
    $user = User::factory()->create();

    $document = app(CreateDocument::class)->handle(Actor::user($user), ['type' => 'invoice', 'customer_id' => $customer->id, 'date' => '2026-10-11']);

    expect($document->status)->toBe(DocumentStatus::Draft)
        ->and($document->number)->toBeNull()
        ->and($document->contact_id)->toBe($contact->id)
        ->and($document->service_date?->toDateString())->toBe('2026-10-11')
        ->and($document->due_date?->toDateString())->toBe('2026-10-25')
        ->and($document->valid_until)->toBeNull()
        ->and($document->intro)->toBe('Thank you for the good cooperation.')
        ->and($document->template_id)->toBe($template->id)
        ->and($document->locale)->toBe('de')
        ->and($document->custom)->toBe(['project_name' => 'Relaunch'])
        ->and($document->created_by)->toBe($user->id)
        ->and($document->groups)->toHaveCount(1)
        ->and($document->groups[0]->title)->toBeNull()
        ->and($document->events()->pluck('action')->all())->toBe([EventAction::Created]);
});

it('sets valid until for offers and accepts groups right away', function () {
    $document = draft(DocumentType::Offer, [itemRow('Workshop', '1', '890'), itemRow('Hosting', '12', '49', ['kind' => 'optional'])], ['date' => '2026-10-01']);

    expect($document->valid_until?->toDateString())->toBe('2026-10-31')
        ->and($document->groups[0]->positions->pluck('kind')->all())->toBe([PositionKind::Item, PositionKind::Optional])
        ->and($document->net_total)->toBe('890.00')
        ->and($document->gross_total)->toBe('1059.10')
        ->and($document->events()->pluck('action')->all())->toBe([EventAction::Created, EventAction::Updated]);
});

it('refuses to create a cancellation without an invoice', function () {
    expect(fn () => app(CreateDocument::class)->handle(systemActor(), ['type' => 'cancellation']))
        ->toThrow(ActionNotAllowedException::class);
});

it('saves only the given fields and recomputes the totals', function () {
    $document = draft(DocumentType::Invoice, [itemRow('Consulting', '10', '95')]);

    $updated = app(UpdateDraft::class)->handle(systemActor(), $document, ['intro' => 'Hello']);
    expect($updated->intro)->toBe('Hello')
        ->and($updated->groups[0]->positions)->toHaveCount(1)
        ->and($updated->gross_total)->toBe('1130.50');

    $updated = app(UpdateDraft::class)->handle(systemActor(), $updated, ['groups' => [
        ['title' => 'Umsetzung', 'positions' => [itemRow('Frontend', '52', '95'), ['kind' => 'text', 'title' => 'Two review rounds included.']]],
    ]]);
    expect($updated->groups->pluck('title')->all())->toBe(['Umsetzung'])
        ->and($updated->net_total)->toBe('4940.00')
        ->and($updated->tax_total)->toBe('938.60');
});

it('switches to the default contact of a new customer', function () {
    $document = draft();
    $customer = Customer::factory()->create();
    $contact = Contact::factory()->for($customer)->create(['is_default' => true]);

    expect(app(UpdateDraft::class)->handle(systemActor(), $document, ['customer_id' => $customer->id])->contact_id)->toBe($contact->id);
});

it('rejects invalid input with paths and saves nothing', function () {
    FieldDefinition::factory()->create(['scope' => FieldScope::Document, 'key' => 'po_number', 'label' => 'PO number', 'doc_types' => ['invoice']]);
    FieldDefinition::factory()->create(['scope' => FieldScope::Position, 'key' => 'ticket', 'label' => 'Ticket', 'type' => FieldType::Select, 'options' => ['SHOP-142'], 'doc_types' => ['invoice']]);
    $document = draft(DocumentType::Invoice, [itemRow('Consulting', '1', '100')]);
    $foreignContact = Contact::factory()->create();

    $errors = draftErrors(fn () => app(UpdateDraft::class)->handle(systemActor(), $document, [
        'intro' => 'must not be saved',
        'contact_id' => $foreignContact->id,
        'custom' => ['po_number' => 7, 'offer_note' => 'x'],
        'groups' => [['title' => null, 'positions' => [
            itemRow('A', '12,5'),
            itemRow('B', '1', '100', ['custom' => ['ticket' => 'SHOP-999']]),
            itemRow('C', '1', '100', ['kind' => 'optional']),
        ]]],
    ]));

    expect(array_keys($errors))->toBe(['groups.0.positions.0.quantity'])
        ->and($document->fresh()->intro)->not->toBe('must not be saved');

    $errors = draftErrors(fn () => app(UpdateDraft::class)->handle(systemActor(), $document, [
        'contact_id' => $foreignContact->id,
        'custom' => ['po_number' => 7, 'offer_note' => 'x'],
        'groups' => [['title' => null, 'positions' => [
            itemRow('B', '1', '100', ['custom' => ['ticket' => 'SHOP-999']]),
            itemRow('C', '1', '100', ['kind' => 'optional']),
            itemRow('D', '1', '0', ['unit_price' => 12.5]),
        ]]],
    ]));

    expect(array_keys($errors))->toBe(['groups.0.positions.2.unit_price']);

    $errors = draftErrors(fn () => app(UpdateDraft::class)->handle(systemActor(), $document, [
        'contact_id' => $foreignContact->id,
        'custom' => ['po_number' => 7, 'offer_note' => 'x'],
        'groups' => [['title' => null, 'positions' => [
            itemRow('B', '1', '100', ['custom' => ['ticket' => 'SHOP-999']]),
            itemRow('C', '1', '100', ['kind' => 'optional']),
        ]]],
    ]));

    expect(array_keys($errors))->toBe([
        'custom.po_number',
        'custom.offer_note',
        'groups.0.positions.0.custom.ticket',
        'groups.0.positions.1.kind',
        'contact_id',
    ])
        ->and($errors['custom.po_number'][0])->toBe('PO number must be text.')
        ->and($document->fresh()->groups[0]->positions->pluck('title')->all())->toBe(['Consulting']);
});

it('refuses to update or delete a finalized document, also after a racing finalize', function () {
    $document = draft();
    $stale = Document::query()->findOrFail($document->id);
    Document::query()->whereKey($document->id)->update(['number' => 'INV-1', 'status' => 'open', 'finalized_at' => now()]);

    expect(fn () => app(UpdateDraft::class)->handle(systemActor(), $stale, ['intro' => 'late autosave']))->toThrow(DocumentLockedException::class)
        ->and(fn () => app(DeleteDraft::class)->handle(systemActor(), $stale))->toThrow(DocumentLockedException::class)
        ->and($document->fresh()->intro)->not->toBe('late autosave')
        ->and($document->fresh()->positions()->count())->toBe(1);
});

it('deletes a draft and keeps the event', function () {
    $document = draft();

    app(DeleteDraft::class)->handle(systemActor(), $document);

    expect(Document::query()->count())->toBe(0)
        ->and(DocumentEvent::query()->where('action', EventAction::Deleted)->value('payload'))->toMatchArray(['type' => 'invoice']);
});

it('rejects amounts the columns cannot hold with a field error instead of a database error (review M2)', function () {
    $document = draft();
    $update = fn (array $positions) => validationErrors(fn () => app(UpdateDraft::class)->handle(systemActor(), $document, [
        'groups' => [['title' => null, 'positions' => $positions]],
    ]));

    expect($update([itemRow('Huge', '99999999999', '99999999999')]))->toHaveKey('groups.0.positions.0.unit_price')
        ->and($update([itemRow('A', '60', '99999999999'), itemRow('B', '60', '99999999999')]))->toHaveKey('groups.0')
        ->and(validationErrors(fn () => app(UpdateDraft::class)->handle(systemActor(), $document, [
            'groups' => [['title' => null, 'positions' => [[...itemRow(), 'quantity' => 123456789012]]]],
        ])))->toHaveKey('groups.0.positions.0.quantity')
        ->and($document->fresh()->gross_total)->toBe('119.00');
});
