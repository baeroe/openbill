<?php

use App\Actions\AcceptInvitation;
use App\Actions\ChangeUserRole;
use App\Actions\DisableUser;
use App\Actions\EnableUser;
use App\Actions\InviteUser;
use App\Enums\EventAction;
use App\Enums\UserRole;
use App\Exceptions\ActionNotAllowedException;
use App\Exceptions\OwnerRequiredException;
use App\Models\Document;
use App\Models\User;
use App\Models\UserInvitation;
use App\Support\Actor;
use App\Support\EventLog;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;

function ownerActor(): array
{
    $owner = User::factory()->owner()->create();

    return [$owner, Actor::user($owner)];
}

it('invites by email and role and turns the invitation into an account once', function () {
    [, $actor] = ownerActor();

    $invitation = app(InviteUser::class)->handle($actor, ['email' => ' lena@example.com ', 'role' => 'member']);
    expect($invitation->email)->toBe('lena@example.com')
        ->and($invitation->expires_at->isFuture())->toBeTrue();

    $user = app(AcceptInvitation::class)->handle(systemActor(), $invitation, ['name' => 'Lena Sommer', 'password' => 'long-enough', 'password_confirmation' => 'long-enough']);
    expect($user->role)->toBe(UserRole::Member)
        ->and($user->email)->toBe('lena@example.com')
        ->and($invitation->fresh()->accepted_at)->not->toBeNull();

    $errors = validationErrors(fn () => app(AcceptInvitation::class)->handle(systemActor(), $invitation->fresh(), ['name' => 'Again', 'password' => 'long-enough', 'password_confirmation' => 'long-enough']));
    expect(array_keys($errors))->toBe(['invitation']);
});

it('replaces an open invitation to the same address and refuses existing accounts', function () {
    [, $actor] = ownerActor();
    User::factory()->create(['email' => 'taken@example.com']);

    $first = app(InviteUser::class)->handle($actor, ['email' => 'nils@example.com', 'role' => 'member']);
    app(InviteUser::class)->handle($actor, ['email' => 'nils@example.com', 'role' => 'owner']);

    expect(UserInvitation::query()->where('email', 'nils@example.com')->pluck('role')->map->value->all())->toBe(['owner'])
        ->and(UserInvitation::query()->find($first->id))->toBeNull()
        ->and(array_keys(validationErrors(fn () => app(InviteUser::class)->handle($actor, ['email' => 'TAKEN@example.com', 'role' => 'member']))))->toBe(['email']);
});

it('refuses an invitation whose address got an account in the meantime', function () {
    [, $actor] = ownerActor();
    $invitation = app(InviteUser::class)->handle($actor, ['email' => 'mia@example.com', 'role' => 'member']);
    User::factory()->create(['email' => 'mia@example.com']);

    expect(array_keys(validationErrors(fn () => app(AcceptInvitation::class)->handle(systemActor(), $invitation, ['name' => 'Mia', 'password' => 'long-enough', 'password_confirmation' => 'long-enough']))))->toBe(['email']);
});

it('lets only owners manage users (review focus)', function (Closure $run) {
    $member = User::factory()->create();
    $other = User::factory()->create();

    expect(fn () => $run(Actor::user($member), $other))->toThrow(OwnerRequiredException::class);
})->with([
    'invite' => [fn (Actor $actor) => app(InviteUser::class)->handle($actor, ['email' => 'x@example.com', 'role' => 'member'])],
    'change role' => [fn (Actor $actor, User $user) => app(ChangeUserRole::class)->handle($actor, $user, ['role' => 'owner'])],
    'disable' => [fn (Actor $actor, User $user) => app(DisableUser::class)->handle($actor, $user)],
    'enable' => [fn (Actor $actor, User $user) => app(EnableUser::class)->handle($actor, $user)],
]);

it('keeps the last active owner (review focus)', function () {
    [$owner, $actor] = ownerActor();

    expect(fn () => app(ChangeUserRole::class)->handle($actor, $owner, ['role' => 'member']))->toThrow(ActionNotAllowedException::class)
        ->and(fn () => app(DisableUser::class)->handle($actor, $owner))->toThrow(ActionNotAllowedException::class);

    $second = User::factory()->owner()->create();
    app(ChangeUserRole::class)->handle($actor, $second, ['role' => 'member']);
    expect($second->fresh()->role)->toBe(UserRole::Member);

    // a disabled owner does not count: the only active owner still cannot step down
    $disabledOwner = User::factory()->owner()->create(['disabled_at' => now()]);
    expect(fn () => app(ChangeUserRole::class)->handle($actor, $owner, ['role' => 'member']))->toThrow(ActionNotAllowedException::class);
    expect($disabledOwner->fresh()->role)->toBe(UserRole::Owner);
});

it('never disables oneself', function () {
    [$owner, $actor] = ownerActor();
    User::factory()->owner()->create();

    expect(fn () => app(DisableUser::class)->handle($actor, $owner))->toThrow(ActionNotAllowedException::class, __('errors.cannot_disable_self'));
});

it('disables a user: tokens and sessions revoked, documents and events keep their author', function () {
    [, $actor] = ownerActor();
    $user = User::factory()->create(['remember_token' => 'old-remember-token']);
    apiToken(['api:read'], null, $user);
    DB::table('sessions')->insert(['id' => 'sess-1', 'user_id' => $user->id, 'ip_address' => null, 'user_agent' => null, 'payload' => '', 'last_activity' => time()]);
    $document = Document::factory()->finalized()->create(['created_by' => $user->id]);
    $event = EventLog::record($document, Actor::user($user), EventAction::Finalized);

    $disabled = app(DisableUser::class)->handle($actor, $user);

    expect($disabled->disabled_at)->not->toBeNull()
        ->and(User::query()->find($user->id))->not->toBeNull()
        ->and($user->fresh()->remember_token)->not->toBe('old-remember-token')
        ->and(DB::table('personal_access_tokens')->where('tokenable_id', $user->id)->count())->toBe(0)
        ->and(DB::table('sessions')->where('user_id', $user->id)->count())->toBe(0)
        ->and($document->fresh()->created_by)->toBe($user->id)
        ->and($event->fresh()->user_id)->toBe($user->id);
    // the auth provider no longer knows the account: an old session or remember cookie resolves to a guest
    expect(Auth::guard('web')->getProvider()->retrieveById($user->id))->toBeNull();
});

it('enables a disabled user again; old tokens stay revoked and new ones need an active account', function () {
    [, $actor] = ownerActor();
    $user = User::factory()->create();
    app(DisableUser::class)->handle($actor, $user);

    expect(fn () => apiToken(['api:read'], null, $user->fresh()))->toThrow(ActionNotAllowedException::class);

    app(EnableUser::class)->handle($actor, $user->fresh());
    expect($user->fresh()->disabled_at)->toBeNull()
        ->and(Auth::guard('web')->getProvider()->retrieveById($user->id)?->getAuthIdentifier())->toBe($user->id);
});
