<?php

namespace App\Domain\Compliance;

use App\Domain\Fields\FieldDefinitionData;
use App\Domain\Totals\GroupInput;
use App\Enums\ComplianceProfile;
use App\Enums\DocumentType;
use App\Enums\TaxationMode;

final readonly class ComplianceInput
{
    /**
     * @param  array<string, mixed>  $custom  document custom values
     * @param  list<GroupInput>  $groups
     * @param  array<string, mixed>|null  $contactCustom  null = no contact chosen
     * @param  array<string, string>  $unitCodes  unit id => UN/ECE code ('' if none)
     * @param  list<string>  $taxRateIds
     * @param  list<FieldDefinitionData>  $fieldDefinitions  all definitions; filtered per level here
     */
    public function __construct(
        public DocumentType $type,
        public ComplianceProfile $profile,
        public TaxationMode $taxationMode,
        public ?string $date,
        public ?string $serviceDate,
        public ?string $dueDate,
        public array $custom,
        public array $groups,
        public PartyFacts $org,
        public ?PartyFacts $customer,
        public ?array $contactCustom,
        public array $unitCodes,
        public array $taxRateIds,
        public array $fieldDefinitions,
    ) {}
}
