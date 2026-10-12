<?php

namespace App\Http\Controllers\Api;

use App\Actions\IssueApiToken;
use App\Actions\ListApiTokens;
use App\Actions\RevokeApiToken;
use App\Enums\TokenAbility;
use App\Http\Api\ApiJson;
use App\Http\Api\CurrentActor;
use App\Http\Api\RequestBody;
use App\Http\Controllers\Controller;
use App\Models\PersonalAccessToken;
use App\Models\User;
use App\Support\ApiTokens;
use App\Support\Text;
use Illuminate\Auth\AuthenticationException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;
use LogicException;

/** Tokens of the signed-in user – settings page "API & MCP", session only (ApiMiddleware::SESSION). */
final class ApiTokensController extends Controller
{
    public function index(Request $request, ListApiTokens $list): JsonResponse
    {
        return ApiJson::ok($list->handle(CurrentActor::from($request)));
    }

    /** The plain-text token is part of this answer only; the list never shows it. */
    public function store(Request $request, IssueApiToken $issue): JsonResponse
    {
        $actor = CurrentActor::from($request);
        $user = $request->user();
        if (! $user instanceof User) {
            throw new AuthenticationException;
        }
        $body = RequestBody::object($request);
        // toolkit tokens (templates:write, bound to one template) come from the template editor (phase 9)
        Validator::make(
            $body,
            ['abilities.*' => [Rule::notIn([TokenAbility::TemplatesWrite->value])]],
            ['abilities.*.not_in' => Text::t('tokens.toolkit_elsewhere')],
        )->validate();

        $token = $issue->handle($actor, $user, Arr::only($body, ['name', 'abilities']));
        $model = $token->accessToken;
        if (! $model instanceof PersonalAccessToken) {
            throw new LogicException('Sanctum must use App\Models\PersonalAccessToken.');
        }

        return ApiJson::ok(['token' => ApiTokens::row($model), 'plain_text_token' => $token->plainTextToken], 201);
    }

    public function destroy(Request $request, RevokeApiToken $revoke): Response
    {
        $actor = CurrentActor::from($request);
        $revoke->handle($actor, ApiTokens::ownedBy((string) $actor->userId)->findOrFail((string) $request->route('id')));

        return response()->noContent();
    }
}
