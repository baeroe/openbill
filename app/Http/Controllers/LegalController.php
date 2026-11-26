<?php

namespace App\Http\Controllers;

use App\Actions\ReadPublicTextDocument;
use App\Http\Api\FileResponse;
use App\Support\Actor;
use Illuminate\Http\Request;
use Illuminate\Http\Response;

/** GET /legal/{slug} and /legal/{slug}/{number}: public texts as PDF, without login. */
final class LegalController extends Controller
{
    public function __invoke(Request $request, ReadPublicTextDocument $read): Response
    {
        $slug = (string) $request->route('slug');
        $number = $request->route('number');
        $file = $read->handle(Actor::system(), $slug, is_string($number) ? $number : null) ?? abort(404);

        $response = FileResponse::download($file, inline: true);
        // a version never changes; "latest" is asked again every time
        $response->headers->set('Cache-Control', is_string($number) ? 'public, max-age=31536000, immutable' : 'no-cache');

        return $response;
    }
}
