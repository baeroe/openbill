<?php

use App\Models\User;
use Inertia\Testing\AssertableInertia as Assert;

$translation = fn (string $key, string $expected) => fn ($translations) => ($translations[$key] ?? null) === $expected;

it('is English by default whatever the browser says', function () use ($translation) {
    $this->withHeader('Accept-Language', 'de-DE,de;q=0.9')->get('/en/login')
        ->assertOk()
        ->assertSee('lang="en"', false)
        ->assertInertia(fn (Assert $page) => $page
            ->component('login')
            ->where('locale', 'en')
            ->where('translations', $translation('login.submit', 'Log in')));
});

it('takes the language from the prefix and remembers it', function () use ($translation) {
    $this->get('/de/login')
        ->assertSee('lang="de"', false)
        ->assertCookie('locale', 'de')
        ->assertInertia(fn (Assert $page) => $page
            ->where('locale', 'de')
            ->where('translations', $translation('login.submit', 'Anmelden')));
});

it('sends unprefixed entry points to the remembered language', function () {
    $this->get('/')->assertRedirect('/en');
    $this->get('/login')->assertRedirect('/en/login');
    $this->withCookie('locale', 'de')->get('/')->assertRedirect('/de');
    $this->withCookie('locale', 'de')->get('/login')->assertRedirect('/de/login');
});

it('answers unknown language prefixes with 404', function () {
    $this->get('/fr/login')->assertNotFound();
    $this->get('/fr')->assertNotFound();
});

it('ignores a manipulated language cookie', function () {
    $this->withCookie('locale', '../../etc')->get('/')->assertRedirect('/en');
});

it('keeps the language when a guest is sent to the login', function () {
    $this->get('/de')->assertRedirect('/de/login');
});

it('sends a signed-in user from the login to the start page in the URL language', function () {
    $this->actingAs(User::factory()->create())
        ->withCookie('locale', 'en')
        ->get('/de/login')
        ->assertRedirect('/de');
});

it('shows the start page with the signed-in user but without secrets', function () {
    $user = User::factory()->owner()->create(['name' => 'Anna Berg', 'email' => 'anna@example.com']);

    $this->actingAs($user)->get('/de')
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('overview')
            ->where('locale', 'de')
            ->where('auth.user.id', $user->id)
            ->where('auth.user.email', 'anna@example.com')
            ->where('auth.user.role', 'owner')
            ->missing('auth.user.password'));
});

it('shares no user with guests', function () {
    $this->get('/en/login')->assertInertia(fn (Assert $page) => $page->where('auth.user', null));
});
