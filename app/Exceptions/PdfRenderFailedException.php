<?php

namespace App\Exceptions;

use App\Support\Text;
use Throwable;

/** Gotenberg was unreachable, too slow or answered with an error (503: try again later). */
final class PdfRenderFailedException extends DomainActionException
{
    public static function unreachable(Throwable $previous): self
    {
        return new self(Text::t('rendering.pdf_unreachable'), 0, $previous);
    }

    public static function answered(int $status, string $body): self
    {
        $message = mb_substr(trim(strip_tags($body)), 0, 300);

        return new self(Text::t('rendering.pdf_failed', ['status' => $status, 'message' => $message]));
    }

    public function status(): int
    {
        return 503;
    }
}
