<?php

namespace App\Http\Controllers\Api;

use App\Actions\ChangePassword;
use App\Http\Api\CurrentActor;
use App\Http\Api\RequestBody;
use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Auth\AuthenticationException;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Auth;

/** The signed-in user's own account – settings "Your account", session only (ApiMiddleware::SESSION). */
final class AccountController extends Controller
{
    public function password(Request $request, ChangePassword $change): Response
    {
        $user = $request->user();
        if (! $user instanceof User) {
            throw new AuthenticationException;
        }
        $session = $request->hasSession() ? $request->session() : null;
        $change->handle(CurrentActor::from($request), $user, RequestBody::object($request), $session?->getId());

        // this session stays signed in under a new id; a remember cookie is reissued with the rotated token
        $guard = Auth::guard('web');
        if ($session !== null) {
            $guard->login($user, $request->cookies->has($guard->getRecallerName()));
        }

        return response()->noContent();
    }
}
