<?php

use App\Actions\SaveCustomer;
use App\Models\Customer;
use Illuminate\Validation\ValidationException;

it('stores master data without surrounding blanks', function () {
    $customer = app(SaveCustomer::class)->handle(systemActor(), [
        'name' => '  Hafenkontor Lindqvist GmbH ',
        'city' => ' Hamburg ',
        'email' => ' buchhaltung@hafenkontor.example ',
        'vat_id' => ' DE987654321 ',
        'contacts' => [['first_name' => ' Mira ', 'last_name' => 'Albers  ', 'email' => ' mira@hafenkontor.example']],
    ]);

    $contact = $customer->contacts->first();
    expect($customer->name)->toBe('Hafenkontor Lindqvist GmbH')
        ->and($customer->city)->toBe('Hamburg')
        ->and($customer->email)->toBe('buchhaltung@hafenkontor.example')
        ->and($customer->vat_id)->toBe('DE987654321')
        ->and($contact->first_name)->toBe('Mira')
        ->and($contact->last_name)->toBe('Albers')
        ->and($contact->email)->toBe('mira@hafenkontor.example');
});

it('refuses a name of blanks only', function () {
    app(SaveCustomer::class)->handle(systemActor(), ['name' => '   ']);
})->throws(ValidationException::class);

it('gives a new customer with an empty number the next number', function () {
    $customer = app(SaveCustomer::class)->handle(systemActor(), ['name' => 'Hotel Alpenglück', 'number' => '  ']);

    expect($customer->number)->toBe('C-1001');
});

it('keeps the number of an existing customer when the number is sent empty', function () {
    $customer = Customer::factory()->create(['number' => 'K-1003']);

    $saved = app(SaveCustomer::class)->handle(systemActor(), ['number' => '', 'city' => 'Oberstdorf'], $customer);

    expect($saved->number)->toBe('K-1003')->and($saved->city)->toBe('Oberstdorf');
});
