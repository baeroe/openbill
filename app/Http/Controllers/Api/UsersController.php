<?php

namespace App\Http\Controllers\Api;

use App\Actions\ChangeUserRole;
use App\Actions\DisableUser;
use App\Actions\EnableUser;
use App\Actions\ListUsers;
use App\Http\Api\ApiJson;
use App\Http\Api\CurrentActor;
use App\Http\Api\RequestBody;
use App\Http\Controllers\Controller;
use App\Models\User;
use App\Support\UserRows;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/** Users of the instance – only for the session of the own UI (ApiMiddleware::SESSION). */
final class UsersController extends Controller
{
    public function index(Request $request, ListUsers $list): JsonResponse
    {
        return ApiJson::ok($list->handle(CurrentActor::from($request), app()->getLocale()));
    }

    public function update(Request $request, ChangeUserRole $change): JsonResponse
    {
        $actor = CurrentActor::from($request);
        $user = $change->handle($actor, $this->user($request), RequestBody::object($request));

        return ApiJson::ok(UserRows::user($user, $actor->userId));
    }

    public function disable(Request $request, DisableUser $disable): JsonResponse
    {
        $actor = CurrentActor::from($request);

        return ApiJson::ok(UserRows::user($disable->handle($actor, $this->user($request)), $actor->userId));
    }

    public function enable(Request $request, EnableUser $enable): JsonResponse
    {
        $actor = CurrentActor::from($request);

        return ApiJson::ok(UserRows::user($enable->handle($actor, $this->user($request)), $actor->userId));
    }

    private function user(Request $request): User
    {
        return User::query()->findOrFail((string) $request->route('id'));
    }
}
