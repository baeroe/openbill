<?php

namespace App\ApiResource\Input;

/** Body of POST /api/documents/{id}/convert (documentation only; the processor reads the raw JSON). */
final class ConvertInput
{
    /** confirmation, invoice or cancellation */
    public string $type = '';
}
