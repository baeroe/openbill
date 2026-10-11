<?php

use App\Enums\ComplianceProfile;
use App\Models\Contact;
use App\Models\Customer;
use App\Models\Document;
use App\Models\DocumentTypeSetting;
use App\Models\NumberSequence;
use App\Models\Organization;
use App\Models\TaxRate;
use App\Models\Unit;

it('ships the base master data with a fresh database', function () {
    expect(Organization::query()->count())->toBe(1)
        ->and(Organization::current()->locale)->toBe('en')
        ->and(DocumentTypeSetting::query()->orderBy('type')->pluck('type')->all())->toBe(['cancellation', 'confirmation', 'invoice', 'offer'])
        ->and(DocumentTypeSetting::query()->findOrFail('invoice')->profile)->toBe(ComplianceProfile::Basic)
        ->and(DocumentTypeSetting::query()->findOrFail('invoice')->payment_term_days)->toBe(14)
        ->and(NumberSequence::query()->whereNull('year')->orderBy('doc_type')->pluck('pattern')->all())
        ->toBe(['CN-{YYYY}-{0000}', 'OC-{YYYY}-{0000}', 'INV-{YYYY}-{0000}', 'Q-{YYYY}-{0000}'])
        ->and(TaxRate::query()->orderBy('sort')->pluck('percent')->all())->toBe(['19.00', '7.00', '0.00'])
        ->and(Unit::query()->orderBy('sort')->pluck('code')->all())->toBe(['HUR', 'DAY', 'H87', 'LS', 'KMT', 'MON']);
});

it('uses ULIDs and casts amounts to strings', function () {
    $document = Document::factory()->create(['net_total' => '12.5']);

    expect($document->id)->toHaveLength(26)
        ->and($document->customer_id)->toHaveLength(26)
        ->and($document->fresh()->net_total)->toBe('12.50')
        ->and($document->fresh()->date->toDateString())->toBe(now()->toDateString());
});

it('soft-deletes customers and contacts', function () {
    $customer = Customer::factory()->has(Contact::factory())->create();
    $contact = $customer->contacts()->firstOrFail();

    $contact->delete();
    $customer->delete();

    expect(Customer::withTrashed()->find($customer->id))->not->toBeNull()
        ->and(Customer::query()->find($customer->id))->toBeNull()
        ->and(Contact::withTrashed()->find($contact->id))->not->toBeNull();
});
