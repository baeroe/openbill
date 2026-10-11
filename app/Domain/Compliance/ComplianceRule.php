<?php

namespace App\Domain\Compliance;

/** Value = suffix of the translation key compliance.<value>. */
enum ComplianceRule: string
{
    case DateMissing = 'date_missing';
    case CustomerMissing = 'customer_missing';
    case NoItems = 'no_items';
    case PositionTitleMissing = 'position_title_missing';
    case TaxRateMissing = 'tax_rate_missing';
    case UnitMissing = 'unit_missing';
    case OrgFieldMissing = 'org_field_missing';
    case CustomerFieldMissing = 'customer_field_missing';
    case ContactFieldMissing = 'contact_field_missing';
    case DocumentFieldMissing = 'document_field_missing';
    case PositionFieldMissing = 'position_field_missing';
    case OrgAddressMissing = 'org_address_missing';
    case OrgTaxIdMissing = 'org_tax_id_missing';
    case OrgSellerIdMissing = 'org_seller_id_missing';
    case OrgVatIdRequired = 'org_vat_id_required';
    case OrgIbanMissing = 'org_iban_missing';
    case CustomerAddressIncomplete = 'customer_address_incomplete';
    case CustomerVatIdMissing = 'customer_vat_id_missing';
    case ServiceDateMissing = 'service_date_missing';
    case DueDateMissing = 'due_date_missing';
    case UnitCodeMissing = 'unit_code_missing';
    case QuantityZero = 'quantity_zero';
}
