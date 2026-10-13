<?php

namespace App\Actions;

use App\Support\Actor;
use App\Support\NumberRange;
use Illuminate\Validation\ValidationException;

/** GET /api/customer-numbering/preview: the next customer number for an unsaved pattern (settings form). */
final class PreviewCustomerNumber
{
    /**
     * @param  array<string, mixed>  $input  pattern, reset_yearly?, next_value?
     * @return array{number: string|null, valid: bool, message: string|null}
     *
     * @throws ValidationException
     */
    public function handle(Actor $actor, array $input): array
    {
        return PreviewDocumentNumber::check(NumberRange::customer(), $input);
    }
}
