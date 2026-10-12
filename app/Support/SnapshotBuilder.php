<?php

namespace App\Support;

use App\Models\Contact;
use App\Models\Customer;
use App\Models\Document;
use App\Models\FieldDefinition;
use App\Models\Organization;
use App\Models\TaxRate;
use App\Models\Unit;

/**
 * Master data a document depends on, in the shape stored in document_snapshots.data.
 * Drafts are computed from build() (live data), finalized documents from their stored snapshot.
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

        return [
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
