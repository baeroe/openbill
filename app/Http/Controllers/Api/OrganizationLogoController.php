<?php

namespace App\Http\Controllers\Api;

use App\Actions\ReadOrganizationLogo;
use App\Actions\RemoveOrganizationLogo;
use App\Actions\UpdateOrganizationLogo;
use App\Http\Api\ApiJson;
use App\Http\Api\CurrentActor;
use App\Http\Api\FileResponse;
use App\Http\Controllers\Controller;
use App\Support\StoredImage;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Validator;

/** GET|POST|DELETE /api/organization/logo (multipart "logo"). */
final class OrganizationLogoController extends Controller
{
    public function show(Request $request, ReadOrganizationLogo $read): Response
    {
        $file = $read->handle(CurrentActor::from($request)) ?? abort(404);

        return FileResponse::download($file, inline: true)->withHeaders(StoredImage::headers());
    }

    public function store(Request $request, UpdateOrganizationLogo $update): JsonResponse
    {
        /** @var UploadedFile $file */
        $file = Validator::make($request->allFiles(), ['logo' => ['required', 'file']])->validate()['logo'];
        $org = $update->handle(CurrentActor::from($request), $file);

        return ApiJson::ok(['has_logo' => true, 'updated_at' => $org->updated_at?->toAtomString()]);
    }

    public function destroy(Request $request, RemoveOrganizationLogo $remove): Response
    {
        $remove->handle(CurrentActor::from($request));

        return response()->noContent();
    }
}
