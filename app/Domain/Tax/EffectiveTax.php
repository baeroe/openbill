<?php

namespace App\Domain\Tax;

use App\Domain\Money\Decimal;
use App\Enums\TaxationMode;
use App\Enums\TaxCategory;
use App\Enums\TaxTreatment;
use Brick\Math\BigDecimal;

/** The tax that really applies to a position: small business and customer treatment override the rate. */
final readonly class EffectiveTax
{
    public function __construct(
        public BigDecimal $percent,
        public TaxCategory $category,
        public ?string $note,
    ) {}

    public static function resolve(?string $taxRateId, TaxContext $ctx): ?self
    {
        if ($ctx->taxationMode === TaxationMode::SmallBusiness) {
            return new self(Decimal::zero(), TaxCategory::E, $ctx->notes->smallBusiness);
        }
        if ($ctx->taxTreatment === TaxTreatment::EuReverseCharge) {
            return new self(Decimal::zero(), TaxCategory::AE, $ctx->notes->reverseCharge);
        }
        if ($ctx->taxTreatment === TaxTreatment::ThirdCountry) {
            return new self(Decimal::zero(), TaxCategory::G, $ctx->notes->thirdCountry);
        }

        $rate = $ctx->rate($taxRateId);

        return $rate === null ? null : new self($rate->percent, $rate->category, $rate->exemptionNote);
    }
}
