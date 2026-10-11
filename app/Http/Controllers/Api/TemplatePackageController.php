<?php

namespace App\Http\Controllers\Api;

use App\Actions\ExportTemplatePackage;
use App\Http\Api\CurrentActor;
use App\Http\Api\FileResponse;
use App\Http\Controllers\Controller;
use App\Models\Template;
use Illuminate\Http\Request;
use Illuminate\Http\Response;

/** GET /api/templates/{id}/package – template package ZIP (toolkit "pnpm pull", export). */
final class TemplatePackageController extends Controller
{
    public function __invoke(Request $request, ExportTemplatePackage $export): Response
    {
        $template = Template::query()->with('assets')->findOrFail((string) $request->route('id'));

        return FileResponse::download($export->handle(CurrentActor::from($request), $template));
    }
}
