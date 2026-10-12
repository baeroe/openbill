<?php

namespace App\Http\Controllers;

use App\Actions\AcceptInvitation;
use App\Models\UserInvitation;
use App\Support\Actor;
use App\Support\InvitationLinks;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Inertia\Inertia;
use Inertia\Response;

/** Signed invitation link (guest): set name and password, then signed in. */
class InvitationController extends Controller
{
    public function show(string $invitation): Response
    {
        $model = UserInvitation::query()->find($invitation);

        return Inertia::render('invitation', [
            'state' => InvitationLinks::state($model),
            'email' => $model?->email,
            'role' => $model?->role->value,
        ]);
    }

    public function store(Request $request, string $invitation, AcceptInvitation $accept): RedirectResponse
    {
        $user = $accept->handle(Actor::system(), UserInvitation::query()->findOrFail($invitation), $request->only(['name', 'password', 'password_confirmation']));
        Auth::login($user);
        $request->session()->regenerate();

        return redirect()->route('home');
    }
}
