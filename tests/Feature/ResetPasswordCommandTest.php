<?php

use App\Console\Commands\ResetUserPassword;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;

/*
 * Review I2: php artisan app:reset-password <email> – the password comes from a prompt or STDIN, never an argument.
 */
afterEach(fn () => ResetUserPassword::$stdin = 'php://stdin');

function passwordOnStdin(string $contents): void
{
    $file = tempnam(sys_get_temp_dir(), 'pw');
    file_put_contents($file, $contents);
    ResetUserPassword::$stdin = $file;
}

it('asks twice without echo and ends all sessions of the account', function () {
    $user = User::factory()->create(['password' => 'old-password', 'remember_token' => 'old-token']);
    DB::table('sessions')->insert(['id' => 'sess-1', 'user_id' => $user->id, 'ip_address' => null, 'user_agent' => null, 'payload' => '', 'last_activity' => time()]);

    $this->artisan('app:reset-password', ['email' => $user->email])
        ->expectsQuestion('New password (at least 8 characters)', 'new-password')
        ->expectsQuestion('Repeat the new password', 'new-password')
        ->expectsOutputToContain('New password set')
        ->assertSuccessful();

    $user->refresh();
    expect(Hash::check('new-password', $user->password))->toBeTrue()
        ->and($user->remember_token)->not->toBe('old-token')
        ->and(DB::table('sessions')->where('user_id', $user->id)->count())->toBe(0);
});

it('refuses different repetitions and short passwords', function (string $first, string $second) {
    $user = User::factory()->create(['password' => 'old-password']);

    $this->artisan('app:reset-password', ['email' => $user->email])
        ->expectsQuestion('New password (at least 8 characters)', $first)
        ->expectsQuestion('Repeat the new password', $second)
        ->assertFailed();

    expect(Hash::check('old-password', $user->fresh()->password))->toBeTrue();
})->with([
    'not repeated' => ['new-password', 'other-password'],
    'too short' => ['short', 'short'],
]);

it('reads the first line of STDIN when not run interactively', function () {
    $user = User::factory()->create(['password' => 'old-password']);
    passwordOnStdin("piped-password\nignored\n");

    $this->artisan('app:reset-password', ['email' => $user->email, '--no-interaction' => true])->assertSuccessful();

    expect(Hash::check('piped-password', $user->fresh()->password))->toBeTrue();
});

it('fails for an empty STDIN and unknown accounts', function () {
    $user = User::factory()->create(['password' => 'old-password']);
    passwordOnStdin('');

    $this->artisan('app:reset-password', ['email' => $user->email, '--no-interaction' => true])->assertFailed();
    $this->artisan('app:reset-password', ['email' => 'nobody@example.com', '--no-interaction' => true])->assertFailed();

    expect(Hash::check('old-password', $user->fresh()->password))->toBeTrue();
});

it('takes no password argument', function () {
    $definition = $this->app->make(ResetUserPassword::class)->getDefinition();

    expect(array_keys($definition->getArguments()))->toBe(['email'])
        ->and($definition->hasOption('password'))->toBeFalse();
});
