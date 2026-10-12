<?php

use App\Models\User;
use App\Models\UserInvitation;
use App\Support\InvitationLinks;
use Inertia\Testing\AssertableInertia as Assert;

function relativeLink(UserInvitation $invitation, string $locale = 'en'): string
{
    return str_replace(url('/'), '', InvitationLinks::for($invitation, $locale));
}

it('shows an open invitation and creates the account', function () {
    $invitation = UserInvitation::factory()->create(['email' => 'lena@example.com']);
    $link = relativeLink($invitation, 'de');

    $this->get($link)->assertOk()->assertInertia(fn (Assert $page) => $page->component('invitation')->where('state', 'open')->where('email', 'lena@example.com'));

    $this->post($link, ['name' => 'Lena Sommer', 'password' => 'long-enough', 'password_confirmation' => 'long-enough'])->assertRedirect('/de');
    $this->assertAuthenticatedAs(User::query()->where('email', 'lena@example.com')->sole());
});

it('explains expired and used invitations and refuses tampered links (review focus)', function () {
    $expired = UserInvitation::factory()->create(['expires_at' => now()->subDay()]);
    $used = UserInvitation::factory()->create(['accepted_at' => now()]);
    $open = UserInvitation::factory()->create();

    $this->get(relativeLink($expired))->assertOk()->assertInertia(fn (Assert $page) => $page->where('state', 'expired'));
    $this->get(relativeLink($used))->assertOk()->assertInertia(fn (Assert $page) => $page->where('state', 'closed'));
    $this->get(relativeLink($open).'x')->assertForbidden();
    $this->get("/en/invitations/{$open->id}")->assertForbidden();
});

it('keeps the form errors on the page', function () {
    $link = relativeLink(UserInvitation::factory()->create());

    $this->from($link)->post($link, ['name' => '', 'password' => 'short', 'password_confirmation' => 'other'])
        ->assertRedirect($link)
        ->assertSessionHasErrors(['name', 'password']);
    $this->assertGuest();
});

it('shows the invitation of a disabled inviter as no longer valid', function () {
    $inviter = User::factory()->owner()->create(['disabled_at' => now()]);
    $invitation = UserInvitation::factory()->create(['invited_by_id' => $inviter->id]);

    $this->get(relativeLink($invitation))->assertOk()->assertInertia(fn (Assert $page) => $page->where('state', 'closed'));
});
