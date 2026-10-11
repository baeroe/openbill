<?php

namespace App\Domain\Conversion;

use App\Domain\Totals\GroupInput;

/** What the new draft gets; ids of groups/positions are assigned when it is saved. */
final readonly class ConversionPlan
{
    /**
     * @param  list<GroupInput>  $groups
     * @param  array<string, mixed>  $custom
     * @param  list<string>  $droppedFields  "document.<key>" / "position.<key>" not valid for the target type
     */
    public function __construct(
        public array $groups,
        public array $custom,
        public ?string $serviceDate,
        public ?string $serviceDateEnd,
        public ?string $dueDate,
        public array $droppedFields,
    ) {}
}
