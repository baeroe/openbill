<?php

namespace App\Http\Controllers;

use App\Actions\DownloadTemplateToolkit;
use App\Http\Api\FileResponse;
use App\Models\Template;
use App\Models\User;
use App\Support\Actor;
use Illuminate\Http\Request;
use Illuminate\Http\Response;

/**
 * POST /{locale}/templates/{id}/toolkit – toolkit ZIP with a new token, only for the signed-in session (CSRF); the
 * template editor fetches it. Errors come as Problem Details (bootstrap/app.php), like /api. OPENBILL_URL in the ZIP is
 * APP_URL, so APP_URL must be the address authors reach openbill under (https).
 */
final class TemplateToolkitController extends Controller
{
    public function __invoke(Request $request, string $id, DownloadTemplateToolkit $download): Response
    {
        /** @var User $user */
        $user = $request->user();
        $template = Template::query()->with('assets')->findOrFail($id);

        // APP_URL, never the Host of the request: behind a proxy or with a forged Host the token would go elsewhere
        return FileResponse::download($download->handle(Actor::user($user), $user, $template, (string) config('app.url')))
            ->header('Cache-Control', 'no-store, private');
    }
}
