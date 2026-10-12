<?php

namespace App\Domain\Tax;

use App\Domain\Money\Decimal;
use App\Enums\CustomerKind;
use App\Enums\SupplyType;
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
            if ($ctx->supplyType === SupplyType::Goods) {
                return new self(Decimal::zero(), TaxCategory::G, $ctx->notes->thirdCountry);
            }
            // services: to a business the place of supply is abroad (§ 3a (2) UStG, not subject to VAT, O); to a
            // consumer it stays in Germany (§ 3a (1) UStG): the regular rate of the position below, no note
            if ($ctx->customerKind === CustomerKind::Business) {
                return new self(Decimal::zero(), TaxCategory::O, $ctx->notes->thirdCountryServices);
            }
        }

        $rate = $ctx->rate($taxRateId);

        return $rate === null ? null : new self($rate->percent, $rate->category, $rate->exemptionNote);
    }
}
