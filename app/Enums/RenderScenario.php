<?php

namespace App\Enums;

/** Sample data sets for template previews (SampleDataFactory). */
enum RenderScenario: string
{
    case ShortInvoice = 'short_invoice';
    case LongInvoice = 'long_invoice';
    case SmallBusiness = 'small_business';
    case ReverseCharge = 'reverse_charge';
    case OfferWithOptions = 'offer_with_options';
    case TextDocument = 'text_document';

    public function documentType(): DocumentType
    {
        return match ($this) {
            self::OfferWithOptions => DocumentType::Offer,
            self::TextDocument => DocumentType::Text,
            default => DocumentType::Invoice,
        };
    }
}
