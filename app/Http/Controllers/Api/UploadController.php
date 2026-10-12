<?php

namespace App\Http\Controllers\Api;

use App\Actions\ReadUpload;
use App\Actions\StoreUpload;
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

/** POST /api/uploads (multipart "file") and GET /api/uploads/{name} – images of image fields. */
final class UploadController extends Controller
{
    public function store(Request $request, StoreUpload $store): JsonResponse
    {
        /** @var UploadedFile $file */
        $file = Validator::make($request->allFiles(), ['file' => ['required', 'file']])->validate()['file'];

        return ApiJson::ok($store->handle(CurrentActor::from($request), $file), 201);
    }

    public function show(Request $request, ReadUpload $read): Response
    {
        $file = $read->handle(CurrentActor::from($request), (string) $request->route('name')) ?? abort(404);

        return FileResponse::download($file, inline: true)->withHeaders(StoredImage::headers());
    }
}
