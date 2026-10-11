<?php

namespace App\Rendering\Liquid;

/**
 * What filters and limits need besides the value (register "openbill"): document language, the template's
 * own translations and the deadline of the current rendering.
 */
final readonly class RenderEnv
{
    public const REGISTER = 'openbill';

    /**
     * @param  array<string, array<string, string>>  $translations  manifest "translations" by locale
     * @param  int|null  $deadline  hrtime(true) in nanoseconds after which rendering stops, null for none
     */
    public function __construct(
        public string $locale,
        public array $translations = [],
        public ?int $deadline = null,
    ) {}

    /** Deadline $seconds from now. */
    public static function deadlineIn(int $seconds): int
    {
        return hrtime(true) + $seconds * 1_000_000_000;
    }

    public function expired(): bool
    {
        return $this->deadline !== null && hrtime(true) > $this->deadline;
    }

    /**
     * @throws RenderTimeoutException
     */
    public function checkDeadline(): void
    {
        if ($this->expired()) {
            throw new RenderTimeoutException;
        }
    }
}
