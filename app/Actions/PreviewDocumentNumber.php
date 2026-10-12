<?php

namespace App\Actions;

use App\Domain\Numbering\NumberFormatter;
use App\Enums\DocumentType;
use App\Support\Actor;
use App\Support\Text;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\ValidationException;

/**
 * GET /api/document-types/{type}/number-preview: the next number for an unsaved pattern (settings form). The same
 * rules as UpdateDocumentType; problems come back as message instead of 422, so the preview can explain them.
 */
final class PreviewDocumentNumber
{
    public function __construct(private readonly AllocateDocumentNumber $numbers) {}

    /**
     * @param  array<string, mixed>  $input  pattern, reset_yearly?, next_value?
     * @return array{number: string|null, valid: bool, message: string|null}
     *
     * @throws ValidationException
     */
    public function handle(Actor $actor, DocumentType $type, array $input): array
    {
        $data = Validator::make($input, [
            'pattern' => ['required', 'string', 'max:64'],
            'reset_yearly' => ['sometimes', 'boolean'],
            'next_value' => ['sometimes', 'nullable', 'integer', 'min:1', 'max:99999999'],
        ])->validate();

        $pattern = (string) $data['pattern'];
        if (! NumberFormatter::isValidPattern($pattern)) {
            return ['number' => null, 'valid' => false, 'message' => Text::t('errors.number_pattern_sequence')];
        }
        if ((bool) ($data['reset_yearly'] ?? false) && ! NumberFormatter::hasYear($pattern)) {
            return ['number' => null, 'valid' => false, 'message' => Text::t('errors.number_pattern_year')];
        }
        $today = now();
        $sequence = isset($data['next_value']) ? (int) $data['next_value'] : $this->numbers->nextValue($type, $today->toDateString());

        return ['number' => NumberFormatter::format($pattern, $today, $sequence), 'valid' => true, 'message' => null];
    }
}
