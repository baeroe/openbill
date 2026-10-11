<?php

namespace App\Domain\Fields;

final readonly class CustomValidationResult
{
    /**
     * @param  array<string, mixed>  $values  normalized values (decimals as strings, blanks as null)
     * @param  list<FieldError>  $errors
     */
    public function __construct(
        public array $values,
        public array $errors,
    ) {}

    public function ok(): bool
    {
        return $this->errors === [];
    }
}
