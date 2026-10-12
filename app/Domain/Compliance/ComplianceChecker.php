<?php

namespace App\Domain\Compliance;

use App\Domain\Fields\FieldDefinitionData;
use App\Domain\Fields\FieldRegistry;
use App\Domain\Totals\PositionInput;
use App\Enums\ComplianceProfile;
use App\Enums\CustomerKind;
use App\Enums\DocumentType;
use App\Enums\FieldScope;
use App\Enums\PositionKind;
use App\Enums\SupplyType;
use App\Enums\TaxationMode;
use App\Enums\TaxTreatment;

/** Port of checkCompliance() from prototypes/clickdummy-v2/src/domain/compliance.ts. */
final class ComplianceChecker
{
    /** @return list<ComplianceIssue> */
    public static function check(ComplianceInput $in): array
    {
        $items = [];
        foreach ($in->groups as $group) {
            foreach ($group->positions as $position) {
                if ($position->kind === PositionKind::Item) {
                    $items[] = $position;
                }
            }
        }

        $issues = [];
        if ($in->date === null || $in->date === '') {
            $issues[] = new ComplianceIssue('document.date', ComplianceRule::DateMissing);
        }
        if ($in->customer === null) {
            $issues[] = new ComplianceIssue('document.customer', ComplianceRule::CustomerMissing);
        }
        if ($items === []) {
            $issues[] = new ComplianceIssue('positions', ComplianceRule::NoItems);
        }
        foreach ($items as $p) {
            $title = ['title' => self::title($p)];
            if (trim($p->title) === '') {
                $issues[] = new ComplianceIssue("positions.{$p->id}.title", ComplianceRule::PositionTitleMissing);
            }
            if ($in->taxationMode === TaxationMode::Regular && ! in_array($p->taxRateId, $in->taxRateIds, true)) {
                $issues[] = new ComplianceIssue("positions.{$p->id}.tax_rate", ComplianceRule::TaxRateMissing, $title);
            }
            if ($p->unitId === null || ! array_key_exists($p->unitId, $in->unitCodes)) {
                $issues[] = new ComplianceIssue("positions.{$p->id}.unit", ComplianceRule::UnitMissing, $title);
            }
        }

        $defs = $in->fieldDefinitions;
        array_push($issues, ...self::requiredCustom(FieldRegistry::forScope($defs, FieldScope::Org), $in->org->custom, 'org.', ComplianceRule::OrgFieldMissing));
        if ($in->customer !== null) {
            array_push($issues, ...self::requiredCustom(FieldRegistry::forScope($defs, FieldScope::Customer), $in->customer->custom, 'customer.', ComplianceRule::CustomerFieldMissing));
        }
        if ($in->contactCustom !== null) {
            array_push($issues, ...self::requiredCustom(FieldRegistry::forScope($defs, FieldScope::Contact), $in->contactCustom, 'contact.', ComplianceRule::ContactFieldMissing));
        }
        array_push($issues, ...self::requiredCustom(FieldRegistry::forScope($defs, FieldScope::Document, $in->type), $in->custom, 'document.custom.', ComplianceRule::DocumentFieldMissing));
        $positionDefs = FieldRegistry::forScope($defs, FieldScope::Position, $in->type);
        foreach ($items as $p) {
            array_push($issues, ...self::requiredCustom($positionDefs, $p->custom, "positions.{$p->id}.custom.", ComplianceRule::PositionFieldMissing, ['title' => self::title($p)]));
        }

        if ($in->profile !== ComplianceProfile::En16931) {
            return $issues;
        }

        if (trim($in->org->name) === '' || ! $in->org->addressComplete()) {
            $issues[] = new ComplianceIssue('org.address', ComplianceRule::OrgAddressMissing);
        }
        // services to third-country customers are not subject to VAT (category O): BR-O-02 forbids the VAT IDs in the
        // XML, so BR-CO-26 needs the legal registration ID (BT-30)
        $thirdCountryServices = $in->customer?->taxTreatment === TaxTreatment::ThirdCountry && $in->customer->supplyType === SupplyType::Services;
        $consumer = $in->customer?->customerKind === CustomerKind::Consumer;
        $notSubjectToVat = $in->taxationMode === TaxationMode::Regular && $thirdCountryServices && ! $consumer;
        // services to a third-country consumer are taxed like at home (regular rate, § 3a (1) UStG)
        $exempt = $in->customer?->taxTreatment === TaxTreatment::EuReverseCharge
            || ($in->customer?->taxTreatment === TaxTreatment::ThirdCountry && ! $thirdCountryServices);
        if ($notSubjectToVat) {
            if (trim($in->org->registrationId) === '') {
                $issues[] = new ComplianceIssue('org.registration_id', ComplianceRule::OrgSellerIdMissing);
            }
        } elseif (trim($in->org->vatId) === '') {
            // BR-AE-02 / BR-G-02 (and § 14a UStG): reverse charge and exports need the seller's VAT ID. A small
            // business always invoices with category E (EffectiveTax), where the tax number is enough (BR-E-02).
            if ($in->taxationMode === TaxationMode::Regular && $exempt) {
                $issues[] = new ComplianceIssue('org.vat_id', ComplianceRule::OrgVatIdRequired);
            } else {
                if (trim($in->org->taxNumber) === '') {
                    $issues[] = new ComplianceIssue('org.vat_id', ComplianceRule::OrgTaxIdMissing);
                }
                // BR-CO-26: the seller needs a VAT ID (BT-31) or a legal registration ID (BT-30); a tax number is not enough
                if (trim($in->org->registrationId) === '') {
                    $issues[] = new ComplianceIssue('org.registration_id', ComplianceRule::OrgSellerIdMissing);
                }
            }
        }
        if (trim($in->org->iban) === '') {
            $issues[] = new ComplianceIssue('org.iban', ComplianceRule::OrgIbanMissing);
        }
        if ($in->customer !== null && ! $in->customer->addressComplete()) {
            $issues[] = new ComplianceIssue('customer.address', ComplianceRule::CustomerAddressIncomplete);
        }
        if ($in->customer?->taxTreatment === TaxTreatment::EuReverseCharge && trim($in->customer->vatId) === '') {
            $issues[] = new ComplianceIssue('customer.vat_id', ComplianceRule::CustomerVatIdMissing);
        }
        if ($in->serviceDate === null || $in->serviceDate === '') {
            $issues[] = new ComplianceIssue('document.service_date', ComplianceRule::ServiceDateMissing);
        }
        if ($in->type === DocumentType::Invoice && ($in->dueDate === null || $in->dueDate === '')) {
            $issues[] = new ComplianceIssue('document.due_date', ComplianceRule::DueDateMissing);
        }
        foreach ($items as $p) {
            $title = ['title' => self::title($p)];
            if ($p->unitId !== null && array_key_exists($p->unitId, $in->unitCodes) && trim($in->unitCodes[$p->unitId]) === '') {
                $issues[] = new ComplianceIssue("positions.{$p->id}.unit", ComplianceRule::UnitCodeMissing, $title);
            }
            if ($p->quantity->isZero()) {
                $issues[] = new ComplianceIssue("positions.{$p->id}.quantity", ComplianceRule::QuantityZero, $title);
            }
        }

        return $issues;
    }

    /**
     * @param  list<FieldDefinitionData>  $definitions
     * @param  array<string, mixed>  $values
     * @param  array<string, string>  $params
     * @return list<ComplianceIssue>
     */
    private static function requiredCustom(array $definitions, array $values, string $prefix, ComplianceRule $rule, array $params = []): array
    {
        $issues = [];
        foreach ($definitions as $definition) {
            if ($definition->required && FieldRegistry::isEmpty($values[$definition->key] ?? null)) {
                $issues[] = new ComplianceIssue($prefix.$definition->key, $rule, [...$params, 'label' => $definition->label]);
            }
        }

        return $issues;
    }

    private static function title(PositionInput $position): string
    {
        return trim($position->title) !== '' ? $position->title : '–';
    }
}
