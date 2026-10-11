<?php

use App\Models\User;
use Illuminate\Support\Facades\Route;

beforeEach(function () {
    $this->user = User::factory()->create(['email' => 'anna@example.com', 'password' => 'secret-pass']);
});

it('logs in and lands on the start page in the language of the login', function () {
    $this->post('/de/login', ['email' => 'anna@example.com', 'password' => 'secret-pass'])
        ->assertRedirect(url('/de'));

    $this->assertAuthenticatedAs($this->user);
});

it('only remembers the login when asked to', function () {
    $recaller = fn () => auth()->guard('web')->getRecallerName();

    $this->post('/en/login', ['email' => 'anna@example.com', 'password' => 'secret-pass'])
        ->assertCookieMissing($recaller());
    auth()->logout();

    $this->post('/en/login', ['email' => 'anna@example.com', 'password' => 'secret-pass', 'remember' => '1'])
        ->assertCookie($recaller());
});

it('rejects a wrong password with a translated message', function () {
    $this->post('/de/login', ['email' => 'anna@example.com', 'password' => 'wrong'])
        ->assertSessionHasErrors(['email' => 'E-Mail oder Passwort stimmen nicht.']);

    $this->assertGuest();
});

it('validates the form', function () {
    $this->post('/en/login', ['email' => 'not-an-email', 'password' => ''])
        ->assertSessionHasErrors(['email', 'password']);
});

it('returns to the page that asked for the login, in the language of the login', function () {
    // a protected page other than the start page, so the redirect can't be the home default
    Route::middleware(['web', 'auth'])->get('{locale}/probe', fn () => 'ok')->where('locale', 'en|de');

    $this->get('/en/probe?x=1')->assertRedirect('/en/login');

    $this->post('/de/login', ['email' => 'anna@example.com', 'password' => 'secret-pass'])
        ->assertRedirect(url('/de/probe?x=1'));
});

it('ignores an intended URL on another host', function () {
    $this->withSession(['url.intended' => 'https://evil.example/en'])
        ->post('/de/login', ['email' => 'anna@example.com', 'password' => 'secret-pass'])
        ->assertRedirect(url('/de'));
});

it('regenerates the session on login', function () {
    $this->get('/en/login');
    $before = session()->getId();

    // send the guest session along, as a browser would; a failed attempt keeps it (the cookie is honoured)
    $this->withCookie(config('session.cookie'), $before)
        ->post('/en/login', ['email' => 'anna@example.com', 'password' => 'wrong']);
    expect(session()->getId())->toBe($before);

    $this->withCookie(config('session.cookie'), $before)
        ->post('/en/login', ['email' => 'anna@example.com', 'password' => 'secret-pass'])
        ->assertRedirect(url('/en'));

    expect(session()->getId())->not->toBe($before);
});

it('logs out and returns to the login in the same language', function () {
    $this->actingAs($this->user)->post('/de/logout')->assertRedirect(url('/de/login'));

    $this->assertGuest();
});

it('locks the login for a minute after five failed attempts for the same email', function () {
    foreach (['anna@example.com', 'Anna@Example.com', 'ANNA@example.com', 'anna@example.com', 'anna@EXAMPLE.com'] as $email) {
        $this->post('/en/login', ['email' => $email, 'password' => 'wrong'])->assertSessionHasErrors('email');
    }

    // even the right password is refused while locked
    $this->post('/en/login', ['email' => 'anna@example.com', 'password' => 'secret-pass'])
        ->assertSessionHasErrors('email');
    $this->assertGuest();
    expect(session('errors')->first('email'))->toContain('Too many login attempts');

    // another account from the same address is not affected
    User::factory()->create(['email' => 'ben@example.com', 'password' => 'secret-pass']);
    $this->post('/en/login', ['email' => 'ben@example.com', 'password' => 'secret-pass'])
        ->assertRedirect(url('/en'));
    auth()->logout();

    $this->travel(61)->seconds();
    $this->post('/en/login', ['email' => 'anna@example.com', 'password' => 'secret-pass'])
        ->assertRedirect(url('/en'));
    $this->assertAuthenticatedAs($this->user);
});

it('shows the lock message in German on the German login', function () {
    foreach (range(1, 5) as $attempt) {
        $this->post('/de/login', ['email' => 'anna@example.com', 'password' => 'wrong']);
    }

    // assertSessionHasErrors() restarts the session, which turns the JSON-serialized errors back into a ViewErrorBag
    $this->post('/de/login', ['email' => 'anna@example.com', 'password' => 'wrong'])->assertSessionHasErrors('email');

    expect(session('errors')->first('email'))->toContain('Zu viele Anmeldeversuche');
});
