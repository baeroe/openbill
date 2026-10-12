<?php

namespace App\Support;

use App\Enums\CustomerKind;
use App\Enums\DocumentType;
use App\Enums\SupplyType;
use App\Enums\TaxTreatment;
use App\Models\Contact;
use App\Models\Customer;
use App\Models\Document;
use App\Models\FieldDefinition;
use App\Models\Organization;
use App\Models\TaxRate;
use App\Models\Unit;
use Illuminate\Support\Arr;

/**
 * Master data a document depends on, in the shape stored in document_snapshots.data.
 * Drafts are computed from build() (live data; a cancellation takes the tax of its invoice's snapshot),
 * finalized documents from their stored snapshot.
 */
final class SnapshotBuilder
{
    /**
     * @return array<string, mixed>
     */
    public function build(Document $document): array
    {
        $org = Organization::current();
        $customer = $document->customer_id === null ? null : Customer::withTrashed()->find($document->customer_id);
        $contact = $document->contact_id === null ? null : Contact::withTrashed()->find($document->contact_id);
        $template = TemplateResolver::for($document);

        $sources = [
            'org' => self::orgRow($org),
            'customer' => $customer === null ? null : [
                ...$customer->only(['id', 'number', 'name', 'street', 'zip', 'city', 'country', 'email', 'vat_id', 'locale']),
                'tax_treatment' => $customer->tax_treatment->value,
                'supply_type' => $customer->supply_type->value,
                'customer_kind' => $customer->customer_kind->value,
                'custom' => $customer->custom ?? [],
            ],
            'contact' => $contact === null ? null : [
                ...$contact->only(['id', 'salutation', 'first_name', 'last_name', 'position', 'email', 'phone']),
                'custom' => $contact->custom ?? [],
            ],
            'tax_rates' => TaxRate::query()->orderBy('sort')->get()->map(fn (TaxRate $rate): array => [
                'id' => $rate->id,
                'label' => $rate->label,
                'percent' => $rate->percent,
                'category' => $rate->category->value,
                'exemption_note' => $rate->exemption_note,
                'archived' => $rate->archived_at !== null,
            ])->values()->all(),
            'units' => Unit::query()->orderBy('sort')->get()->map(fn (Unit $unit): array => [
                'id' => $unit->id,
                'name' => $unit->name,
                'symbol' => $unit->symbol,
                'decimals' => $unit->decimals,
                'code' => $unit->code,
                'archived' => $unit->archived_at !== null,
            ])->values()->all(),
            'template' => $template === null ? null : [
                ...$template->only(['id', 'name', 'slug', 'version', 'header', 'body', 'footer', 'css']),
                'manifest' => $template->manifest ?? [],
            ],
            'field_definitions' => self::fieldDefinitionRows(),
            // frozen in the document's language: later text changes must not alter a finalized document
            'legal_notes' => LegalNoteTexts::toArray(LegalNoteTexts::for($document->locale)),
        ];

        return $document->type === DocumentType::Cancellation ? self::withInvoiceTax($document, $sources) : $sources;
    }

    /**
     * A cancellation mirrors the tax of the invoice it cancels, never today's master data: small-business status,
     * the customer's tax treatment, supply type and kind, and the tax rates (percent, category, exemption note) come
     * from the invoice's snapshot. Which legal note applies follows from that; its text stays in the cancellation's
     * language. Rates the invoice did not know (added later) stay live.
     *
     * @param  array<string, mixed>  $sources
     * @return array<string, mixed>
     */
    public static function withInvoiceTax(Document $document, array $sources): array
    {
        $invoice = $document->source_id === null ? null : Document::query()->with('snapshot')->find($document->source_id);
        $frozen = $invoice?->snapshot?->data;
        if ($invoice === null || $invoice->type !== DocumentType::Invoice || ! is_array($frozen)) {
            return $sources;
        }

        $sources['org']['taxation_mode'] = $frozen['org']['taxation_mode'] ?? $sources['org']['taxation_mode'];
        $invoiceCustomer = $frozen['customer'] ?? null;
        if (is_array($sources['customer']) && is_array($invoiceCustomer)) {
            $sources['customer']['tax_treatment'] = $invoiceCustomer['tax_treatment'] ?? TaxTreatment::Domestic->value;
            // the defaults are how DomainMapper::taxContext() read older invoice snapshots
            $sources['customer']['supply_type'] = $invoiceCustomer['supply_type'] ?? SupplyType::Goods->value;
            $sources['customer']['customer_kind'] = $invoiceCustomer['customer_kind'] ?? CustomerKind::Business->value;
        }

        $invoiceRates = [];
        foreach ($frozen['tax_rates'] ?? [] as $rate) {
            $invoiceRates[$rate['id']] = $rate;
        }
        $rates = [];
        foreach ($sources['tax_rates'] as $rate) {
            $rates[] = isset($invoiceRates[$rate['id']])
                ? [...$rate, ...Arr::only($invoiceRates[$rate['id']], ['percent', 'category', 'exemption_note'])]
                : $rate;
            unset($invoiceRates[$rate['id']]);
        }
        $sources['tax_rates'] = [...$rates, ...array_values($invoiceRates)];

        return $sources;
    }

    /**
     * @return array<string, mixed>
     */
    public static function orgRow(Organization $org): array
    {
        return [
            ...$org->only(['name', 'street', 'zip', 'city', 'country', 'logo_path', 'vat_id', 'tax_number', 'registration_id', 'iban', 'bic', 'bank_name', 'email', 'phone', 'website', 'locale']),
            'taxation_mode' => $org->taxation_mode->value,
            'custom' => $org->custom ?? [],
        ];
    }

    /**
     * @return list<array<string, mixed>>
     */
    public static function fieldDefinitionRows(): array
    {
        return FieldDefinition::query()->orderBy('sort')->orderBy('label')->get()->map(fn (FieldDefinition $d): array => [
            'id' => $d->id,
            'scope' => $d->scope->value,
            'key' => $d->key,
            'label' => $d->label,
            'type' => $d->type->value,
            'required' => $d->required,
            'default_value' => $d->default_value,
            'help' => $d->help ?? '',
            'options' => $d->options ?? [],
            'doc_types' => $d->doc_types ?? [],
        ])->values()->all();
    }
}
