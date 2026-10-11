<?php

namespace App\Support;

use App\Domain\Fields\FieldError;
use Illuminate\Validation\ValidationException;

/** Domain field errors → Laravel validation errors with the same dot paths. */
final class FieldErrors
{
    /**
     * @param  list<FieldError>  $errors
     * @return array<string, list<string>>
     */
    public static function messages(array $errors): array
    {
        $messages = [];
        foreach ($errors as $error) {
            $messages[$error->path][] = Text::t('fields.error.'.$error->code->value, $error->params);
        }

        return $messages;
    }

    /**
     * @param  list<FieldError>  $errors
     *
     * @throws ValidationException
     */
    public static function throwIfAny(array $errors): void
    {
        if ($errors !== []) {
            throw ValidationException::withMessages(self::messages($errors));
        }
    }
}
