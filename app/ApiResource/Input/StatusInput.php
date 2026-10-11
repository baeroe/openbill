<?php

namespace App\ApiResource\Input;

/** Body of POST /api/documents/{id}/status (documentation only; the processor reads the raw JSON). */
final class StatusInput
{
    /** accepted, rejected, done or paid */
    public string $status = '';
}
