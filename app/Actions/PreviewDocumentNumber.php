<?php

namespace App\Actions;

use App\Enums\DocumentType;
use App\Support\Actor;
use App\Support\NumberRange;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\ValidationException;

/**
 * GET /api/document-types/{type}/number-preview: the next number for an unsaved pattern (settings form). The same
 * rules as UpdateDocumentType; problems come back as message instead of 422, so the preview can explain them.
 */
final class PreviewDocumentNumber
{
    /**
     * @param  array<string, mixed>  $input  pattern, reset_yearly?, next_value?
     * @return array{number: string|null, valid: bool, message: string|null}
     *
     * @throws ValidationException
     */
    public function handle(Actor $actor, DocumentType $type, array $input): array
    {
        return self::check(NumberRange::document($type), $input);
    }

    /**
     * @param  array<string, mixed>  $input
     * @return array{number: string|null, valid: bool, message: string|null}
     *
     * @throws ValidationException
     */
    public static function check(NumberRange $range, array $input): array
    {
        $data = Validator::make($input, [
            'pattern' => ['required', 'string', 'max:64'],
            'reset_yearly' => ['sometimes', 'boolean'],
            'next_value' => ['sometimes', 'nullable', 'integer', 'min:1', 'max:99999999'],
        ])->validate();

        return $range->check(
            (string) $data['pattern'],
            (bool) ($data['reset_yearly'] ?? false),
            isset($data['next_value']) ? (int) $data['next_value'] : null,
            CarbonImmutable::now(),
        );
    }
}
