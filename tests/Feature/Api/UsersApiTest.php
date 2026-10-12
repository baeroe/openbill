<?php

use App\Models\User;
use App\Models\UserInvitation;

it('lists users and open invitations with links for owners only', function () {
    $owner = User::factory()->owner()->create(['name' => 'Anna Owner']);
    $member = User::factory()->create(['name' => 'Ben Member']);
    $this->actingAs($owner, 'web')->postJson('/api/invitations', ['email' => 'lena@example.com', 'role' => 'member'])
        ->assertCreated()
        ->assertJsonPath('email', 'lena@example.com')
        ->assertJsonPath('link', fn (string $link): bool => str_starts_with($link, url('/en/invitations/')) && str_contains($link, 'signature='));

    $this->actingAs($owner, 'web')->getJson('/api/users')
        ->assertOk()
        ->assertJsonPath('users.0.name', 'Anna Owner')
        ->assertJsonPath('users.0.is_self', true)
        ->assertJsonPath('invitations.0.email', 'lena@example.com');

    // after a request auth:sanctum is the default guard: sign in on the web guard like the browser session
    forgetApiAuth();
    $this->actingAs($member, 'web')->getJson('/api/users')
        ->assertOk()
        ->assertJsonPath('invitations.0.link', null);
    $this->actingAs($member, 'web')->postJson('/api/invitations', ['email' => 'x@example.com', 'role' => 'member'])
        ->assertForbidden()
        ->assertJsonPath('reason', 'owner_required');
});

it('changes roles, protects the last owner and disables and enables users over the session API', function () {
    $owner = User::factory()->owner()->create();
    $member = User::factory()->create();

    $this->actingAs($owner, 'web')->patchJson("/api/users/{$owner->id}", ['role' => 'member'])->assertStatus(409)->assertJsonPath('reason', 'last_owner');
    $this->actingAs($owner, 'web')->patchJson("/api/users/{$member->id}", ['role' => 'owner'])->assertOk()->assertJsonPath('role', 'owner');
    $this->actingAs($owner, 'web')->postJson("/api/users/{$owner->id}/disable")->assertStatus(409)->assertJsonPath('reason', 'cannot_disable_self');
    $this->actingAs($owner, 'web')->postJson("/api/users/{$member->id}/disable")->assertOk()->assertJsonPath('disabled_at', fn (?string $at): bool => $at !== null);
    $rows = collect($this->actingAs($owner, 'web')->getJson('/api/users')->json('users'))->keyBy('id');
    expect($rows[$member->id]['disabled_at'])->not->toBeNull()
        ->and($rows[$owner->id]['disabled_at'])->toBeNull();
    $this->actingAs($owner, 'web')->postJson("/api/users/{$member->id}/enable")->assertOk()->assertJsonPath('disabled_at', null);
    $this->actingAs($owner, 'web')->deleteJson("/api/users/{$member->id}")->assertStatus(405);
});

it('revokes invitations', function () {
    $owner = User::factory()->owner()->create();
    $invitation = UserInvitation::factory()->create();

    $this->actingAs($owner, 'web')->deleteJson("/api/invitations/{$invitation->id}")->assertNoContent();
    expect(UserInvitation::query()->find($invitation->id))->toBeNull();
});

it('closes the user endpoints to every API token', function () {
    $this->withToken(apiToken(['api:read', 'api:write']))->getJson('/api/users')->assertForbidden();
});
