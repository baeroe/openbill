<?php

namespace App\EInvoice;

use App\Domain\Totals\Totals;
use App\Enums\DocumentType;
use App\Enums\PositionKind;
use App\Enums\TaxCategory;
use App\Exceptions\EInvoiceInvalidException;
use App\Models\Document;
use App\Support\Text;
use Brick\Math\BigDecimal;
use DOMDocument;
use horstoeko\zugferd\ZugferdDocumentBuilder;
use horstoeko\zugferd\ZugferdProfiles;
use horstoeko\zugferd\ZugferdSettings;
use LibXMLError;
use LogicException;

/**
 * EN 16931 e-invoice (UN/CEFACT CII, Factur-X/ZUGFeRD profile EN 16931) of an invoice or cancellation,
 * built with horstoeko/zugferd from the same data as the PDF (snapshot-shaped sources and totals) and
 * checked against the XSD before it is handed out. A cancellation becomes a credit note (381) with
 * positive amounts that refers to its invoice.
 */
final class CiiBuilder
{
    /**
     * @param  array<string, mixed>  $sources  snapshot-shaped master data
     *
     * @throws EInvoiceInvalidException
     */
    public function build(Document $document, array $sources, Totals $totals): string
    {
        ZugferdSettings::setAmountDecimals(2);
        ZugferdSettings::setPercentDecimals(2);
        ZugferdSettings::setUnitAmountDecimals(4);
        ZugferdSettings::setQuantityDecimals(4);

        $credit = $document->type === DocumentType::Cancellation;
        $amount = fn (BigDecimal $value, int $decimals = CiiAmount::AMOUNT) => CiiAmount::of($credit ? $value->negated() : $value, $decimals);
        $org = $sources['org'];
        $customer = $sources['customer'] ?? [];
        $unitCodes = array_column($sources['units'], 'code', 'id');

        $cii = ZugferdDocumentBuilder::createNew(ZugferdProfiles::PROFILE_EN16931)
            ->setDocumentInformation((string) $document->number, $credit ? '381' : '380', $document->date, 'EUR');
        foreach ($totals->legalNotes as $note) {
            $cii->addDocumentNote($note);
        }

        $cii->setDocumentSeller((string) $org['name'])
            ->setDocumentSellerAddress(self::text($org['street'] ?? null), null, null, self::text($org['zip'] ?? null), self::text($org['city'] ?? null), self::text($org['country'] ?? null));
        // BR-O-02: an invoice with category O carries neither the seller's nor the buyer's VAT ID
        $notSubjectToVat = array_filter($totals->taxBreakdown, fn ($row): bool => $row->category === TaxCategory::O) !== [];
        if (! $notSubjectToVat && self::text($org['vat_id'] ?? null) !== null) {
            $cii->addDocumentSellerTaxRegistration('VA', $org['vat_id']);
        }
        if (self::text($org['tax_number'] ?? null) !== null) {
            $cii->addDocumentSellerTaxRegistration('FC', $org['tax_number']);
        }
        if (self::text($org['registration_id'] ?? null) !== null) {
            // BT-30: with the VAT ID (BT-31) the identifiers BR-CO-26 accepts, and the only one with category O
            $cii->setDocumentSellerLegalOrganisation(self::text($org['registration_id']), null, null);
        }
        if (self::text($org['email'] ?? null) !== null) {
            $cii->setDocumentSellerCommunication('EM', $org['email']);
        }

        $cii->setDocumentBuyer((string) ($customer['name'] ?? ''), self::text($customer['number'] ?? null))
            ->setDocumentBuyerAddress(self::text($customer['street'] ?? null), null, null, self::text($customer['zip'] ?? null), self::text($customer['city'] ?? null), self::text($customer['country'] ?? null));
        if (! $notSubjectToVat && self::text($customer['vat_id'] ?? null) !== null) {
            $cii->addDocumentBuyerTaxRegistration('VA', $customer['vat_id']);
        }

        if ($document->service_date !== null) {
            $cii->setDocumentSupplyChainEvent($document->service_date);
            if ($document->service_date_end !== null) {
                $cii->setDocumentBillingPeriod($document->service_date, $document->service_date_end, null);
            }
        }
        if ($credit && $document->source_id !== null) {
            $invoice = Document::query()->find($document->source_id);
            if ($invoice?->number !== null) {
                $cii->addDocumentInvoiceReferencedDocument($invoice->number, null, $invoice->date);
            }
        }
        if (! $credit && self::text($org['iban'] ?? null) !== null) {
            $cii->addDocumentPaymentMeanToCreditTransfer(str_replace(' ', '', (string) $org['iban']), self::text($org['name'] ?? null), null, self::text($org['bic'] ?? null));
        }
        if ($credit) {
            // BR-CO-25: a positive amount due needs a due date (BT-9) or payment terms (BT-20)
            $cii->addDocumentPaymentTerm(Text::t('einvoice.credit_note_terms', [], $document->locale), $document->due_date);
        } elseif ($document->due_date !== null) {
            $cii->addDocumentPaymentTerm(null, $document->due_date);
        }

        // BT-152/BT-119: category O (not subject to VAT) carries no rate at all (BR-O-05, BR-O-09)
        $line = 0;
        foreach ($document->groups as $group) {
            foreach ($group->positions as $position) {
                if ($position->kind !== PositionKind::Item) {
                    continue;
                }
                $total = $totals->lines[$position->id] ?? throw new LogicException("Position {$position->id} has no line total.");
                $tax = $total->tax ?? throw new LogicException("Position {$position->id} has no tax rate.");
                // BR-27: the net price (BT-146) must not be negative – a discount line carries its sign in the quantity
                $price = BigDecimal::of($position->unit_price);
                $quantity = BigDecimal::of($position->quantity);
                if ($price->isNegative()) {
                    [$price, $quantity] = [$price->negated(), $quantity->negated()];
                }
                $cii->addNewPosition((string) ++$line)
                    ->setDocumentPositionProductDetails($position->title, self::text($position->description))
                    ->setDocumentPositionNetPrice(CiiAmount::of($price, CiiAmount::UNIT))
                    ->setDocumentPositionQuantity($amount($quantity, CiiAmount::UNIT), $position->unit_id === null ? 'C62' : ($unitCodes[$position->unit_id] ?? 'C62'))
                    ->addDocumentPositionTax($tax->category->value, 'VAT', $tax->category === TaxCategory::O ? null : CiiAmount::of($tax->percent, CiiAmount::AMOUNT))
                    ->setDocumentPositionLineSummation($amount($total->net));
            }
        }

        foreach ($totals->taxBreakdown as $row) {
            $cii->addDocumentTax($row->category->value, 'VAT', $amount($row->net), $amount($row->tax), $row->category === TaxCategory::O ? null : CiiAmount::of($row->percent, CiiAmount::AMOUNT), self::exemptionReason($row->category, $totals, $document->locale));
        }
        $cii->setDocumentSummation($amount($totals->gross), $amount($totals->gross), $amount($totals->net), null, null, $amount($totals->net), $amount($totals->tax));

        $xml = $cii->getContent();
        $errors = self::validate($xml);
        if ($errors !== []) {
            throw new EInvoiceInvalidException($errors);
        }

        return $xml;
    }

    /**
     * Schema errors of a CII document against the EN 16931 XSD shipped with horstoeko/zugferd.
     *
     * @return list<string>
     */
    public static function validate(string $xml): array
    {
        $previous = libxml_use_internal_errors(true);
        try {
            $dom = new DOMDocument;
            if (! $dom->loadXML($xml, LIBXML_NONET)) {
                return self::libxmlErrors() ?: ['The XML is not well-formed.'];
            }
            $dom->schemaValidate(rtrim(ZugferdSettings::getSchemaDirectory(), '/').'/FACTUR-X_EN16931.xsd');

            return self::libxmlErrors();
        } finally {
            libxml_clear_errors();
            libxml_use_internal_errors($previous);
        }
    }

    /** @return list<string> */
    private static function libxmlErrors(): array
    {
        return array_map(fn (LibXMLError $e): string => trim($e->message)." (line {$e->line})", libxml_get_errors());
    }

    /**
     * BT-120 for exempt categories: the position's tax note (e.g. § 19 UStG), else the first legal note, else
     * a standard text per category (BR-E-10, BR-AE-10, BR-G-10, BR-IC-10 require a reason).
     */
    private static function exemptionReason(TaxCategory $category, Totals $totals, string $locale): ?string
    {
        if (in_array($category, [TaxCategory::S, TaxCategory::Z], true)) {
            return null;
        }
        foreach ($totals->lines as $line) {
            if ($line->tax?->category === $category && self::text($line->tax->note) !== null) {
                return $line->tax->note;
            }
        }

        return $totals->legalNotes[0] ?? Text::t('einvoice.exemption.'.strtolower($category->value), [], $locale);
    }

    private static function text(mixed $value): ?string
    {
        return is_string($value) && trim($value) !== '' ? trim($value) : null;
    }
}
