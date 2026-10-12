<?php

namespace App\Domain\Compliance;

use App\Enums\SupplyType;
use App\Enums\TaxTreatment;

/** What the checks need from the organization or a customer. */
final readonly class PartyFacts
{
    /**
     * @param  array<string, mixed>  $custom
     */
    public function __construct(
        public string $name,
        public string $street,
        public string $zip,
        public string $city,
        public string $country,
        public string $vatId = '',
        public string $taxNumber = '',
        public string $iban = '',
        public array $custom = [],
        public ?TaxTreatment $taxTreatment = null,
        public string $registrationId = '',
        public ?SupplyType $supplyType = null,
    ) {}

    public function addressComplete(): bool
    {
        foreach ([$this->street, $this->zip, $this->city, $this->country] as $part) {
            if (trim($part) === '') {
                return false;
            }
        }

        return true;
    }
}
