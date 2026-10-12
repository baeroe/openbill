<?php

namespace App\Http\Controllers\Api;

use App\Actions\RenderPreview;
use App\Http\Api\ApiJson;
use App\Http\Api\CurrentActor;
use App\Http\Api\RequestBody;
use App\Http\Controllers\Controller;
use App\Models\User;
use App\Support\ApiAccess;
use App\Support\Text;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/** POST /api/render – PreviewResult::toArray(); template problems are part of the answer (200). */
final class RenderController extends Controller
{
    /**
     * @throws AuthorizationException a template-bound token asks for another template
     */
    public function __invoke(Request $request, RenderPreview $preview): JsonResponse
    {
        $body = RequestBody::object($request);
        $user = $request->user();
        $templateId = $body['template_id'] ?? null;
        if (! ApiAccess::rendersWith($user instanceof User ? $user->currentAccessToken() : null, is_string($templateId) ? $templateId : null)) {
            throw new AuthorizationException(Text::t('api.problem.missing_ability', ['rule' => ApiAccess::TEMPLATE_READ]));
        }

        return ApiJson::ok($preview->handle(CurrentActor::from($request), $body)->toArray());
    }
}
