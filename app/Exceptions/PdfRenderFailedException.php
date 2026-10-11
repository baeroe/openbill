<?php

namespace App\Exceptions;

use App\Support\Text;
use Illuminate\Support\Facades\Log;
use Throwable;

/** Gotenberg was unreachable, too slow or answered with an error (503: try again later). */
final class PdfRenderFailedException extends DomainActionException
{
    public static function unreachable(Throwable $previous): self
    {
        return new self(Text::t('rendering.pdf_unreachable'), 0, $previous);
    }

    /** The answer may name internal URLs or Chromium details: it goes to the log, the user gets the status only. */
    public static function answered(int $status, string $body): self
    {
        Log::warning('Gotenberg did not return a PDF', ['status' => $status, 'body' => mb_substr($body, 0, 2000)]);

        return new self(Text::t('rendering.pdf_failed', ['status' => $status]));
    }

    public function status(): int
    {
        return 503;
    }
}
