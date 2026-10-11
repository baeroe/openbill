<?php

use App\Actions\CreateDocument;
use App\Actions\FinalizeDocument;
use App\Actions\UpdateDraft;
use App\Contracts\DocumentArchiver;
use App\Enums\DocumentStatus;
use App\Enums\DocumentType;
use App\Enums\EventAction;
use App\Exceptions\ActionNotAllowedException;
use App\Exceptions\ComplianceFailedException;
use App\Exceptions\DocumentLockedException;
use App\Models\Contact;
use App\Models\Customer;
use App\Models\Document;
use App\Models\DocumentSnapshot;
use App\Models\DocumentTypeSetting;
use App\Models\FieldDefinition;
use App\Models\NumberSequence;
use App\Models\Organization;
use App\Models\TaxRate;
use App\Models\Template;
use App\Models\Unit;
use App\Support\DocumentInspector;
use App\Support\GroupWriter;
use App\Support\NullDocumentArchiver;

function invoiceCounter(): int
{
    return (int) NumberSequence::query()->where('doc_type', 'invoice')->where('year', (int) now()->format('Y'))->value('next_value');
}

it('assigns the number, locks the document, stores the snapshot and logs the event', function () {
    $document = draft(DocumentType::Invoice, [itemRow('Consulting', '10', '95')]);

    $done = app(FinalizeDocument::class)->handle(systemActor(), $document);

    expect($done->number)->toBe('INV-'.now()->format('Y').'-0001')
        ->and($done->status)->toBe(DocumentStatus::Open)
        ->and($done->finalized_at)->not->toBeNull()
        ->and($done->gross_total)->toBe('1130.50')
        ->and($done->snapshot)->toBeInstanceOf(DocumentSnapshot::class)
        ->and($done->snapshot->data['customer']['id'])->toBe($document->customer_id)
        ->and($done->events()->pluck('action')->last())->toBe(EventAction::Finalized)
        ->and(invoiceCounter())->toBe(2);
});

it('refuses to finalize twice', function () {
    $done = app(FinalizeDocument::class)->handle(systemActor(), draft());

    expect(fn () => app(FinalizeDocument::class)->handle(systemActor(), $done))->toThrow(DocumentLockedException::class);
});

it('refuses with the issue list when the profile check fails and uses no number', function () {
    DocumentTypeSetting::query()->whereKey('invoice')->update(['profile' => 'en16931']);
    FieldDefinition::factory()->create(['key' => 'po_number', 'label' => 'PO number', 'required' => true, 'doc_types' => ['invoice']]);
    $document = draft(DocumentType::Invoice, [itemRow()], ['customer_id' => null]);

    try {
        app(FinalizeDocument::class)->handle(systemActor(), $document);
        $this->fail('no exception');
    } catch (ComplianceFailedException $e) {
        expect(array_column($e->toArray(), 'path'))->toBe(['document.customer', 'document.custom.po_number', 'org.address', 'org.vat_id', 'org.iban'])
            ->and($e->toArray()[1]['message'])->toBe('PO number is missing.')
            ->and($e->status())->toBe(422);
    }

    expect($document->fresh()->status)->toBe(DocumentStatus::Draft)
        ->and($document->fresh()->number)->toBeNull()
        ->and(invoiceCounter())->toBe(0);
});

it('passes the e-invoice profile with complete data', function () {
    DocumentTypeSetting::query()->whereKey('invoice')->update(['profile' => 'en16931']);
    completeOrganization();

    expect(app(FinalizeDocument::class)->handle(systemActor(), draft())->status)->toBe(DocumentStatus::Open);
});

it('rolls everything back when the archiver fails, so the number stays free', function () {
    app()->bind(DocumentArchiver::class, fn () => new class implements DocumentArchiver
    {
        public function archive(Document $document, DocumentSnapshot $snapshot): void
        {
            throw new RuntimeException('Gotenberg is down');
        }
    });
    $document = draft();

    expect(fn () => app(FinalizeDocument::class)->handle(systemActor(), $document))->toThrow(RuntimeException::class, 'Gotenberg is down');

    expect($document->fresh()->status)->toBe(DocumentStatus::Draft)
        ->and($document->fresh()->number)->toBeNull()
        ->and($document->fresh()->finalized_at)->toBeNull()
        ->and(DocumentSnapshot::query()->count())->toBe(0)
        ->and(invoiceCounter())->toBe(0);

    app()->bind(DocumentArchiver::class, NullDocumentArchiver::class);
    expect(app(FinalizeDocument::class)->handle(systemActor(), $document->fresh())->number)->toBe('INV-'.now()->format('Y').'-0001');
});

it('keeps the finalized document unchanged when master data changes afterwards', function () {
    $template = Template::factory()->create(['body' => '<h1>v1</h1>']);
    $field = FieldDefinition::factory()->create(['key' => 'project_name', 'label' => 'Project', 'doc_types' => ['invoice']]);
    $customer = Customer::factory()->create(['name' => 'Hafenkontor Lindqvist GmbH']);
    $contact = Contact::factory()->for($customer)->create(['first_name' => 'Mira']);
    $document = app(CreateDocument::class)->handle(systemActor(), [
        'type' => 'invoice', 'customer_id' => $customer->id, 'template_id' => $template->id,
        'groups' => [['title' => null, 'positions' => [itemRow('Consulting', '10', '95')]]],
    ]);
    $done = app(FinalizeDocument::class)->handle(systemActor(), $document);
    $before = $done->snapshot->data;

    Organization::current()->forceFill(['name' => 'Renamed', 'taxation_mode' => 'small_business'])->save();
    $customer->forceFill(['name' => 'Renamed customer', 'tax_treatment' => 'third_country'])->save();
    $contact->forceFill(['first_name' => 'Renamed'])->save();
    TaxRate::query()->whereKey(vatRateId())->update(['percent' => '25.00']);
    Unit::query()->whereKey(hourUnitId())->update(['name' => 'Renamed', 'code' => 'XXX']);
    $template->forceFill(['body' => '<h1>v2</h1>'])->save();
    $field->forceFill(['label' => 'Renamed'])->save();
    $customer->delete();

    $fresh = Document::query()->findOrFail($done->id);
    expect($fresh->snapshot->data)->toBe($before)
        ->and($before['customer']['name'])->toBe('Hafenkontor Lindqvist GmbH')
        ->and($before['contact']['first_name'])->toBe('Mira')
        ->and($before['template']['body'])->toBe('<h1>v1</h1>')
        ->and($before['field_definitions'][0]['label'])->toBe('Project')
        ->and($fresh->gross_total)->toBe('1130.50')
        ->and(app(DocumentInspector::class)->totals($fresh)->toArray()['gross'])->toBe('1130.50')
        ->and(fn () => app(UpdateDraft::class)->handle(systemActor(), $fresh, ['intro' => 'x']))->toThrow(DocumentLockedException::class);
});

it('refuses a cancellation whose invoice is no longer cancellable', function () {
    $invoice = draft();
    $cancellation = Document::factory()->type(DocumentType::Cancellation)->create(['customer_id' => $invoice->customer_id, 'source_id' => $invoice->id]);
    GroupWriter::replace($cancellation, [['title' => null, 'positions' => [itemRow('Consulting', '-1', '100')]]]);

    expect(fn () => app(FinalizeDocument::class)->handle(systemActor(), $cancellation->fresh()))
        ->toThrow(ActionNotAllowedException::class);
});
