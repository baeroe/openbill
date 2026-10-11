<?php

namespace App\Exceptions;

use App\Rendering\RenderError;
use App\Support\Text;

/** Finalizing (or a draft PDF) stopped because the template has errors (422 with part, file, line, message). */
final class TemplateRenderFailedException extends DomainActionException
{
    /**
     * @param  list<RenderError>  $errors
     */
    public function __construct(public readonly array $errors)
    {
        parent::__construct(Text::t('rendering.failed', ['count' => count($errors)]));
    }

    /**
     * @return list<array{part: string, file: string|null, line: int|null, message: string}>
     */
    public function toArray(): array
    {
        return array_map(fn (RenderError $error): array => $error->toArray(), $this->errors);
    }

    public function status(): int
    {
        return 422;
    }
}
