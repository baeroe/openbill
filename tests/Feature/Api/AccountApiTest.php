<?php

use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;

/*
 * Review I2: the signed-in user changes their own password (session API, settings "Your account").
 */
function sessionRow(string $id, string $userId): void
{
    DB::table('sessions')->insert(['id' => $id, 'user_id' => $userId, 'ip_address' => null, 'user_agent' => null, 'payload' => '', 'last_activity' => time()]);
}

it('changes the own password, ends the other sessions and rotates the remember token', function () {
    $user = User::factory()->create(['password' => 'old-password', 'remember_token' => 'old-token']);
    $other = User::factory()->create();
    sessionRow('phone', $user->id);
    sessionRow('laptop', $user->id);
    sessionRow('someone-else', $other->id);

    // a request from the own UI (stateful): with a session like in the browser
    $this->actingAs($user, 'web')->withHeader('Referer', url('/'))->putJson('/api/account/password', [
        'current_password' => 'old-password', 'password' => 'new-password', 'password_confirmation' => 'new-password',
    ])->assertNoContent();

    $user->refresh();
    expect(Hash::check('new-password', $user->password))->toBeTrue()
        ->and($user->remember_token)->not->toBe('old-token')
        ->and(DB::table('sessions')->where('user_id', $user->id)->pluck('id')->all())->not->toContain('phone', 'laptop')
        ->and(DB::table('sessions')->where('id', 'someone-else')->exists())->toBeTrue()
        // the current session stays signed in
        ->and(auth('web')->id())->toBe($user->id);
});

it('keeps the session that changed the password', function () {
    $user = User::factory()->create(['password' => 'old-password']);

    $this->actingAs($user, 'web')->withHeader('Referer', url('/'))->putJson('/api/account/password', [
        'current_password' => 'old-password', 'password' => 'new-password', 'password_confirmation' => 'new-password',
    ])->assertNoContent();

    // the stored password hash of the session follows the new password (Sanctum's AuthenticateSession)
    $this->withHeader('Referer', url('/'))->getJson('/api/tokens')->assertOk();
});

it('needs the current password and a confirmed new one of at least 8 characters', function (array $body, string $path) {
    $user = User::factory()->create(['password' => 'old-password']);

    $response = $this->actingAs($user, 'web')->putJson('/api/account/password', $body)
        ->assertUnprocessable()
        ->assertJsonPath('reason', 'validation_failed');

    expect(collect($response->json('violations'))->pluck('path')->all())->toContain($path)
        ->and(Hash::check('old-password', $user->fresh()->password))->toBeTrue();
})->with([
    'wrong current password' => [['current_password' => 'guess', 'password' => 'new-password', 'password_confirmation' => 'new-password'], 'current_password'],
    'missing current password' => [['password' => 'new-password', 'password_confirmation' => 'new-password'], 'current_password'],
    'too short' => [['current_password' => 'old-password', 'password' => 'short', 'password_confirmation' => 'short'], 'password'],
    'not confirmed' => [['current_password' => 'old-password', 'password' => 'new-password', 'password_confirmation' => 'other-password'], 'password'],
]);

it('is not open to API tokens', function () {
    $this->withToken(apiToken(['api:read', 'api:write', 'mcp']))
        ->putJson('/api/account/password', ['current_password' => 'x', 'password' => 'new-password', 'password_confirmation' => 'new-password'])
        ->assertForbidden();
});

it('throttles guesses of the current password', function () {
    $user = User::factory()->create(['password' => 'old-password']);
    $body = ['current_password' => 'guess', 'password' => 'new-password', 'password_confirmation' => 'new-password'];

    foreach (range(1, 10) as $ignored) {
        $this->actingAs($user, 'web')->putJson('/api/account/password', $body)->assertUnprocessable();
    }
    $this->actingAs($user, 'web')->putJson('/api/account/password', $body)->assertTooManyRequests();
});
