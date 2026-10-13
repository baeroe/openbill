<?php

namespace App\Rendering;

use App\Domain\Payment\EpcPayload;
use App\Enums\DocumentStatus;
use App\Enums\DocumentType;
use App\Enums\PositionKind;
use App\Enums\TaxationMode;
use App\Models\Document;
use App\Support\DocumentInspector;
use App\Support\Text;
use Brick\Math\BigDecimal;

/**
 * Liquid context of a document (port of prototypes/clickdummy-v2/src/domain/templateContext.ts):
 * org, customer, contact, document, groups, positions. Custom fields sit directly on their object;
 * core values come last and win (FieldRegistry reserves those keys, so this only matters for bad data).
 * Values are raw – LiquidRenderer escapes them. Amounts are strings, dates YYYY-MM-DD.
 */
final class ContextBuilder
{
    public function __construct(
        private readonly DocumentInspector $inspector,
        private readonly AssetInliner $assets,
    ) {}

    /**
     * @param  array<string, mixed>  $sources  snapshot-shaped master data (SnapshotBuilder, snapshot, SampleDataFactory)
     */
    public function build(Document $document, array $sources): TemplateContext
    {
        $totals = $this->inspector->totals($document, $sources);
        $summary = $totals->toArray();
        $locale = $document->locale;
        $units = array_column($sources['units'], null, 'id');
        $images = self::imageKeys($sources);

        $index = 0;
        $groups = [];
        foreach ($document->groups as $group) {
            $hasTitle = $group->title !== null && $group->title !== '';
            $positions = [];
            foreach ($group->positions as $position) {
                $line = $totals->lines[$position->id] ?? null;
                $unit = $position->unit_id === null ? null : ($units[$position->unit_id] ?? null);
                $positions[] = [
                    ...$this->inlineImages($position->custom ?? [], $images['position']),
                    'index' => $position->kind === PositionKind::Text ? null : ++$index,
                    'kind' => $position->kind->value,
                    'is_item' => $position->kind === PositionKind::Item,
                    'is_text' => $position->kind === PositionKind::Text,
                    'is_optional' => $position->kind === PositionKind::Optional,
                    'title' => $position->title,
                    'description' => $position->description ?? '',
                    'quantity' => Amounts::plain($position->quantity),
                    'unit' => (string) ($unit['symbol'] ?? ''),
                    'unit_name' => (string) ($unit['name'] ?? ''),
                    'unit_code' => (string) ($unit['code'] ?? ''),
                    'unit_price' => Amounts::price($position->unit_price),
                    'tax_percent' => $line?->tax === null ? '0' : (string) $line->tax->percent->strippedOfTrailingZeros(),
                    'total' => $line === null ? '0.00' : (string) $line->net,
                    'group' => $hasTitle ? (string) $group->title : '',
                ];
            }
            $groupTotal = $totals->groups[$group->id] ?? null;
            $groups[] = [
                'title' => $hasTitle ? (string) $group->title : '',
                'has_title' => $hasTitle,
                'total' => $groupTotal === null ? '0.00' : (string) $groupTotal->net,
                'optional_total' => $groupTotal === null ? '0.00' : (string) $groupTotal->optionalNet,
                'positions' => $positions,
            ];
        }

        $org = $sources['org'];
        $customer = $sources['customer'];
        $contact = $sources['contact'];

        return new TemplateContext([
            'org' => [
                ...$this->inlineImages($org['custom'] ?? [], $images['org']),
                ...self::pick($org, ['name', 'street', 'zip', 'city', 'country', 'vat_id', 'tax_number', 'registration_id', 'iban', 'bic', 'bank_name', 'email', 'phone', 'website']),
                'logo' => $this->assets->logo($org['logo_path'] ?? null),
                'taxation_mode' => (string) $org['taxation_mode'],
                'small_business' => $org['taxation_mode'] === TaxationMode::SmallBusiness->value,
                'locale' => (string) ($org['locale'] ?? 'en'),
            ],
            'customer' => $customer === null ? null : [
                ...$this->inlineImages($customer['custom'] ?? [], $images['customer']),
                ...self::pick($customer, ['number', 'name', 'street', 'zip', 'city', 'country', 'email', 'vat_id', 'tax_treatment']),
                'kind' => (string) ($customer['customer_kind'] ?? 'business'),
                'locale' => $customer['locale'] ?? null,
            ],
            'contact' => $contact === null ? null : [
                ...$this->inlineImages($contact['custom'] ?? [], $images['contact']),
                ...self::pick($contact, ['salutation', 'first_name', 'last_name']),
                'full_name' => trim(($contact['first_name'] ?? '').' '.($contact['last_name'] ?? '')),
                ...self::pick($contact, ['position', 'email', 'phone']),
            ],
            'document' => [
                ...$this->inlineImages($document->custom ?? [], $images['document']),
                'type' => $document->type->value,
                'type_label' => Text::t('document_type.'.$document->type->value, [], $locale),
                'status' => $document->status->value,
                'number' => $document->number ?? Text::t('template.draft', [], $locale),
                'date' => $document->date->toDateString(),
                'due_date' => $document->due_date?->toDateString(),
                'valid_until' => $document->valid_until?->toDateString(),
                'service_date' => $document->service_date?->toDateString(),
                'service_date_end' => $document->service_date_end?->toDateString(),
                'locale' => $locale,
                'intro' => $document->intro ?? '',
                'closing' => $document->closing ?? '',
                'net_total' => $summary['net'],
                'tax_total' => $summary['tax'],
                'gross_total' => $summary['gross'],
                'optional_total' => $summary['optional_net'],
                'tax_breakdown' => $summary['tax_breakdown'],
                'legal_notes' => $summary['legal_notes'],
                'source_number' => $document->source_id === null ? null : Document::query()->whereKey($document->source_id)->value('number'),
                'payment_qr' => self::paymentQr($document, $org, $summary['gross']),
            ],
            'positions' => array_merge([], ...array_column($groups, 'positions')),
            'groups' => $groups,
        ], $totals);
    }

    /**
     * GiroCode for finalized invoices with an amount due and an IBAN, '' otherwise (`!= blank` in templates).
     * Built from the raw org values of the sources (the snapshot once finalized), so it is reproducible.
     *
     * @param  array<string, mixed>  $org
     */
    private static function paymentQr(Document $document, array $org, string $gross): string
    {
        if ($document->type !== DocumentType::Invoice || $document->status === DocumentStatus::Draft || $document->number === null) {
            return '';
        }
        $payload = EpcPayload::build(
            (string) ($org['name'] ?? ''),
            (string) ($org['iban'] ?? ''),
            (string) ($org['bic'] ?? ''),
            BigDecimal::of($gross),
            $document->number,
        );

        return $payload === null ? '' : PaymentQr::dataUrl($payload);
    }

    /**
     * @param  array<string, mixed>  $row
     * @param  list<string>  $keys
     * @return array<string, string>
     */
    private static function pick(array $row, array $keys): array
    {
        $values = [];
        foreach ($keys as $key) {
            $values[$key] = (string) ($row[$key] ?? '');
        }

        return $values;
    }

    /**
     * Keys of image fields per level, from the definitions of the sources (snapshot, live or sample).
     *
     * @param  array<string, mixed>  $sources
     * @return array{org: list<string>, customer: list<string>, contact: list<string>, document: list<string>, position: list<string>}
     */
    private static function imageKeys(array $sources): array
    {
        $keys = ['org' => [], 'customer' => [], 'contact' => [], 'document' => [], 'position' => []];
        foreach ($sources['field_definitions'] ?? [] as $definition) {
            if (($definition['type'] ?? null) === 'image' && isset($keys[$definition['scope'] ?? ''])) {
                $keys[$definition['scope']][] = (string) $definition['key'];
            }
        }

        return $keys;
    }

    /**
     * Image fields become data URLs (Chromium's header/footer load no files, the CSP allows data: only).
     *
     * @param  array<string, mixed>  $custom
     * @param  list<string>  $imageKeys
     * @return array<string, mixed>
     */
    private function inlineImages(array $custom, array $imageKeys): array
    {
        foreach ($imageKeys as $key) {
            if (array_key_exists($key, $custom)) {
                $custom[$key] = $this->assets->upload(is_string($custom[$key]) ? $custom[$key] : null);
            }
        }

        return $custom;
    }
}
