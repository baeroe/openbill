<?php

use App\Actions\DeleteCustomer;
use App\Actions\SaveCustomer;
use App\Enums\DocumentType;
use App\Enums\EventAction;
use App\Enums\FieldScope;
use App\Enums\FieldType;
use App\Enums\TaxTreatment;
use App\Exceptions\ActionNotAllowedException;
use App\Models\Contact;
use App\Models\Customer;
use App\Models\Document;
use App\Models\DocumentEvent;
use App\Models\FieldDefinition;
use Illuminate\Validation\ValidationException;

/** @return array<string, list<string>> */
function customerErrors(Closure $run): array
{
    try {
        $run();
    } catch (ValidationException $e) {
        return $e->errors();
    }

    return [];
}

it('creates a customer with contacts and exactly one default contact', function () {
    $customer = app(SaveCustomer::class)->handle(systemActor(), [
        'name' => 'Hafenkontor Lindqvist GmbH',
        'country' => 'de',
        'tax_treatment' => 'domestic',
        'contacts' => [
            ['first_name' => 'Mira', 'last_name' => 'Albers', 'is_default' => true],
            ['first_name' => 'Ole', 'last_name' => 'Brandt', 'is_default' => true],
        ],
    ]);

    expect($customer->number)->toBe('C-1001')
        ->and($customer->country)->toBe('DE')
        ->and($customer->tax_treatment)->toBe(TaxTreatment::Domestic)
        ->and($customer->contacts->where('is_default', true)->pluck('first_name')->all())->toBe(['Mira']);
});

it('continues the highest customer number with its prefix', function () {
    Customer::factory()->create(['number' => 'K-1004']);

    expect(app(SaveCustomer::class)->handle(systemActor(), ['name' => 'Kulturwerk Elbinsel e. V.'])->number)->toBe('K-1005');
});

it('makes the first contact the default when none is marked', function () {
    $customer = app(SaveCustomer::class)->handle(systemActor(), [
        'name' => 'Fjord Analytics AB',
        'contacts' => [['first_name' => 'Elin', 'last_name' => 'Berg']],
    ]);

    expect($customer->contacts->first()?->is_default)->toBeTrue();
});

it('validates custom fields of customers and contacts with paths and enforces required ones', function () {
    FieldDefinition::factory()->create(['scope' => FieldScope::Customer, 'key' => 'industry', 'label' => 'Industry', 'type' => FieldType::Select, 'options' => ['Software', 'Retail'], 'doc_types' => []]);
    FieldDefinition::factory()->create(['scope' => FieldScope::Customer, 'key' => 'supplier_number', 'label' => 'Supplier number', 'required' => true, 'doc_types' => []]);
    FieldDefinition::factory()->create(['scope' => FieldScope::Contact, 'key' => 'department', 'label' => 'Department', 'doc_types' => []]);

    $errors = customerErrors(fn () => app(SaveCustomer::class)->handle(systemActor(), [
        'name' => 'Fjord Analytics AB',
        'custom' => ['industry' => 'Shipping'],
        'contacts' => [['first_name' => 'Elin', 'custom' => ['department' => 7, 'shoe_size' => '42']]],
    ]));

    expect(array_keys($errors))->toBe(['custom.industry', 'custom.supplier_number', 'contacts.0.custom.department', 'contacts.0.custom.shoe_size'])
        ->and($errors['custom.industry'][0])->toBe('Industry must be one of: Software, Retail.')
        ->and(Customer::query()->count())->toBe(0);
});

it('applies default values of customer fields on create', function () {
    FieldDefinition::factory()->create(['scope' => FieldScope::Customer, 'key' => 'industry', 'type' => FieldType::Text, 'default_value' => 'Software', 'doc_types' => []]);

    expect(app(SaveCustomer::class)->handle(systemActor(), ['name' => 'Fjord Analytics AB'])->custom)->toBe(['industry' => 'Software']);
});

it('soft-deletes removed contacts and clears them from drafts only', function () {
    $customer = Customer::factory()->create();
    $kept = Contact::factory()->for($customer)->create(['first_name' => 'Mira']);
    $removed = Contact::factory()->for($customer)->create(['first_name' => 'Ole', 'is_default' => false]);
    $draft = Document::factory()->create(['customer_id' => $customer->id, 'contact_id' => $removed->id]);
    $final = Document::factory()->finalized()->create(['customer_id' => $customer->id, 'contact_id' => $removed->id]);

    app(SaveCustomer::class)->handle(systemActor(), ['contacts' => [['id' => $kept->id, 'first_name' => 'Mira', 'is_default' => true]]], $customer);

    expect(Contact::query()->whereKey($removed->id)->exists())->toBeFalse()
        ->and(Contact::withTrashed()->whereKey($removed->id)->exists())->toBeTrue()
        ->and($draft->fresh()->contact_id)->toBeNull()
        ->and($draft->events()->pluck('payload')->all())->toBe([['fields' => ['contact_id']]])
        ->and($final->fresh()->contact_id)->toBe($removed->id)
        ->and($final->events()->count())->toBe(0);
});

it('refuses a duplicate customer number', function () {
    Customer::factory()->create(['number' => 'K-1001']);

    expect(array_keys(customerErrors(fn () => app(SaveCustomer::class)->handle(systemActor(), ['name' => 'X', 'number' => 'K-1001']))))
        ->toBe(['number']);
});

it('deletes a customer with drafts only and logs the deleted drafts', function () {
    $customer = Customer::factory()->create();
    $draft = Document::factory()->create(['customer_id' => $customer->id]);

    app(DeleteCustomer::class)->handle(systemActor(), $customer);

    expect(Customer::query()->find($customer->id))->toBeNull()
        ->and(Document::query()->find($draft->id))->toBeNull()
        ->and(DocumentEvent::query()->where('action', EventAction::Deleted)->whereNull('document_id')->count())->toBe(1);
});

it('refuses to delete a customer with finalized documents', function () {
    $customer = Customer::factory()->create();
    Document::factory()->finalized()->type(DocumentType::Invoice)->create(['customer_id' => $customer->id]);

    expect(fn () => app(DeleteCustomer::class)->handle(systemActor(), $customer))
        ->toThrow(ActionNotAllowedException::class, 'The customer has finalized documents and cannot be deleted.');
});
