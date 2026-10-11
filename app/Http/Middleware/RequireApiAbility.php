<?php

namespace App\Http\Middleware;

use App\Models\User;
use App\Support\ApiAccess;
use App\Support\Text;
use Closure;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/** api.ability:<rule> after auth:sanctum. Template rules read the template id from the route parameter {id}. */
final class RequireApiAbility
{
    /**
     * @param  Closure(Request): Response  $next
     *
     * @throws AuthorizationException
     */
    public function handle(Request $request, Closure $next, string $rule): Response
    {
        $user = $request->user();
        $token = $user instanceof User ? $user->currentAccessToken() : null;
        $templateId = $request->route('id');

        if (! ApiAccess::allows($token, $rule, is_string($templateId) ? $templateId : null)) {
            throw new AuthorizationException(Text::t('api.problem.missing_ability', ['rule' => $rule]));
        }

        return $next($request);
    }
}
