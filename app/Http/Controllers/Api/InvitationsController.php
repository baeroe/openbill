<?php

namespace App\Http\Controllers\Api;

use App\Actions\InviteUser;
use App\Actions\RevokeInvitation;
use App\Http\Api\ApiJson;
use App\Http\Api\CurrentActor;
use App\Http\Api\RequestBody;
use App\Http\Controllers\Controller;
use App\Models\UserInvitation;
use App\Support\InvitationLinks;
use App\Support\UserRows;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;

/** Invitations by copyable link – session only. The link is in the language of the request (Accept-Language). */
final class InvitationsController extends Controller
{
    public function store(Request $request, InviteUser $invite): JsonResponse
    {
        $invitation = $invite->handle(CurrentActor::from($request), RequestBody::object($request));

        return ApiJson::ok(UserRows::invitation($invitation, InvitationLinks::for($invitation, app()->getLocale())), 201);
    }

    public function destroy(Request $request, RevokeInvitation $revoke): Response
    {
        $revoke->handle(CurrentActor::from($request), UserInvitation::query()->findOrFail((string) $request->route('id')));

        return response()->noContent();
    }
}
