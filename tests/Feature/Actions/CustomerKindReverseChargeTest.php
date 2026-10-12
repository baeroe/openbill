<?php

use App\Actions\SaveCustomer;
use App\Models\Customer;

it('refuses a private person with EU reverse charge and saves nothing', function () {
    $errors = validationErrors(fn () => app(SaveCustomer::class)->handle(systemActor(), [
        'name' => 'Kulturwerk Elbinsel', 'country' => 'AT', 'vat_id' => 'ATU12345678',
        'tax_treatment' => 'eu_reverse_charge', 'customer_kind' => 'consumer',
    ]));

    expect(array_keys($errors))->toBe(['customer_kind'])
        ->and($errors['customer_kind'][0])->toBe('Reverse charge needs a business customer: a private person pays VAT.')
        ->and(Customer::query()->where('name', 'Kulturwerk Elbinsel')->exists())->toBeFalse();
});

it('checks the combination against the stored values on update', function () {
    $consumer = Customer::factory()->create(['customer_kind' => 'consumer', 'tax_treatment' => 'domestic']);
    $business = Customer::factory()->create(['customer_kind' => 'business', 'tax_treatment' => 'eu_reverse_charge']);
    $save = app(SaveCustomer::class);

    expect(array_keys(validationErrors(fn () => $save->handle(systemActor(), ['tax_treatment' => 'eu_reverse_charge'], $consumer))))->toBe(['customer_kind'])
        ->and(array_keys(validationErrors(fn () => $save->handle(systemActor(), ['customer_kind' => 'consumer'], $business))))->toBe(['customer_kind'])
        ->and($consumer->fresh()->tax_treatment->value)->toBe('domestic')
        ->and($business->fresh()->customer_kind->value)->toBe('business');
});

it('keeps the other combinations and untouched older rows working', function () {
    $save = app(SaveCustomer::class);

    $thirdCountry = $save->handle(systemActor(), ['name' => 'Fjord Analytics AB', 'country' => 'NO', 'tax_treatment' => 'third_country', 'customer_kind' => 'consumer']);
    $reverseCharge = $save->handle(systemActor(), ['name' => 'Hotel Alpenglück GmbH', 'country' => 'AT', 'tax_treatment' => 'eu_reverse_charge', 'customer_kind' => 'business']);
    // stored before this rule: changing only the name still works
    $legacy = Customer::factory()->create(['customer_kind' => 'consumer', 'tax_treatment' => 'eu_reverse_charge']);
    $renamed = $save->handle(systemActor(), ['name' => 'Kulturwerk Elbinsel e. V.'], $legacy);

    expect($thirdCountry->customer_kind->value)->toBe('consumer')
        ->and($reverseCharge->tax_treatment->value)->toBe('eu_reverse_charge')
        ->and($renamed->name)->toBe('Kulturwerk Elbinsel e. V.');
});
