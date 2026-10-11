<?php

use App\Models\User;
use Illuminate\Support\Facades\Validator;

it('validates in German with German field names', function () {
    app()->setLocale('de');

    $validator = Validator::make(
        ['email' => 'no-mail', 'contacts' => [['email' => 'no-mail']]],
        ['name' => 'required', 'email' => 'email', 'contacts.*.email' => 'email'],
    );

    expect($validator->errors()->first('name'))->toBe('Name ist erforderlich.')
        ->and($validator->errors()->first('email'))->toBe('E-Mail muss eine gültige E-Mail-Adresse sein.')
        ->and($validator->errors()->first('contacts.0.email'))->toBe('E-Mail muss eine gültige E-Mail-Adresse sein.');
});

it('shows German messages on the German login', function () {
    $this->post('/de/login', ['email' => '', 'password' => 'secret'])
        ->assertSessionHasErrors(['email' => 'E-Mail ist erforderlich.']);
});

it('answers the API in German when asked to', function () {
    $this->withToken(apiToken(user: User::factory()->create()))
        ->withHeader('Accept-Language', 'de')
        ->postJson('/api/customers', ['name' => '   '])
        ->assertUnprocessable()
        ->assertJsonPath('violations.0.path', 'name')
        ->assertJsonPath('violations.0.message', 'Name ist erforderlich.');
});
