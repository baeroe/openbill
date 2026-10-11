<?php

namespace App\Domain\Totals;

/** A position group; title null = loose positions without heading and subtotal. */
final readonly class GroupInput
{
    /**
     * @param  list<PositionInput>  $positions
     */
    public function __construct(
        public string $id,
        public ?string $title,
        public array $positions,
    ) {}
}
