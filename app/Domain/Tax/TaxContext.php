<?php

namespace App\Domain\Tax;

use App\Enums\TaxationMode;
use App\Enums\TaxTreatment;

final readonly class TaxContext
{
    /**
     * @param  list<TaxRateData>  $taxRates
     */
    public function __construct(
        public array $taxRates,
        public TaxationMode $taxationMode,
        public TaxTreatment $taxTreatment,
        public LegalNotes $notes,
    ) {}

    public function rate(?string $id): ?TaxRateData
    {
        foreach ($this->taxRates as $rate) {
            if ($rate->id === $id) {
                return $rate;
            }
        }

        return null;
    }
}
