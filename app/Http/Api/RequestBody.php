<?php

namespace App\Http\Api;

use App\Support\Text;
use Illuminate\Http\Request;
use JsonException;
use Symfony\Component\HttpKernel\Exception\BadRequestHttpException;

/**
 * The raw JSON body as the actions take it: missing keys stay missing, numbers stay numbers
 * (an amount sent as 12.5 is refused by the action with a field path, not by a serializer).
 */
final class RequestBody
{
    /**
     * @return array<string, mixed>
     *
     * @throws BadRequestHttpException
     */
    public static function object(Request $request): array
    {
        $content = trim((string) $request->getContent());
        if ($content === '') {
            return [];
        }

        try {
            $data = json_decode($content, true, 512, JSON_THROW_ON_ERROR);
        } catch (JsonException) {
            throw new BadRequestHttpException(Text::t('api.problem.invalid_json'));
        }
        if (! is_array($data) || ($data !== [] && array_is_list($data))) {
            throw new BadRequestHttpException(Text::t('api.problem.body_not_object'));
        }

        /** @var array<string, mixed> $data */
        return $data;
    }
}
