<?php

namespace App\Rendering;

use App\Domain\Fields\FieldRegistry;
use App\Enums\DocumentStatus;
use App\Enums\DocumentType;
use App\Enums\FieldScope;
use App\Enums\FieldType;
use App\Enums\PositionKind;
use App\Enums\RenderScenario;
use App\Enums\TaxationMode;
use App\Models\Document;
use App\Models\Organization;
use App\Models\Position;
use App\Models\PositionGroup;
use App\Support\DomainMapper;
use App\Support\LegalNoteTexts;
use App\Support\SnapshotBuilder;
use Illuminate\Database\Eloquent\Collection;

/**
 * Deterministic sample documents for template previews (template editor, toolkit, golden tests):
 * fixed dates and numbers, a fictional customer and contact, fixed tax rates and units, custom fields
 * filled from their definitions. Nothing is saved. The organization is the real one; an empty one
 * (fresh instance) is replaced by the fictional Studio Nordlicht.
 */
final class SampleDataFactory
{
    private const DATE = '2026-10-01';

    private const ORG = [
        'name' => 'Studio Nordlicht', 'street' => 'Speicherstraße 12', 'zip' => '20457', 'city' => 'Hamburg', 'country' => 'DE',
        'vat_id' => 'DE123456789', 'tax_number' => '', 'registration_id' => 'HRB 000000, Amtsgericht Hamburg', 'iban' => 'DE02 1203 0000 0000 2020 51', 'bic' => 'BYLADEM1001',
        'bank_name' => 'Demo Bank', 'email' => 'hallo@nordlicht.example', 'phone' => '+49 40 1234567', 'website' => 'nordlicht.example',
    ];

    /** @var array<string, array{0: string, 1: int}> unit key => [UN/ECE code, decimals] */
    private const UNITS = ['hour' => ['HUR', 2], 'day' => ['DAY', 1], 'piece' => ['H87', 0], 'flat' => ['LS', 0], 'month' => ['MON', 0]];

    private const TEXT = [
        'de' => [
            'invoice_intro' => "Hallo {{ contact.first_name }},\nvielen Dank für die gute Zusammenarbeit. Wir berechnen folgende Leistungen:",
            'invoice_closing' => "Bitte überweisen Sie den Betrag bis zum {{ document.due_date | date }}.\nViele Grüße",
            'offer_intro' => "Hallo {{ contact.first_name }},\nwie besprochen bieten wir Ihnen folgende Leistungen an:",
            'offer_closing' => 'Wir freuen uns auf Ihre Rückmeldung.',
            'items' => [['Konzeption', 'Workshop mit Protokoll', '1', 'flat', '890'], ['Gestaltung', 'Startseite und Unterseiten', '3', 'day', '760'], ['Entwicklung', 'Frontend und Backend', '24', 'hour', '95']],
            'groups' => ['Konzept', 'Gestaltung', 'Umsetzung', 'Betrieb'],
            'tasks' => ['Abstimmung', 'Recherche', 'Entwurf', 'Umsetzung', 'Test', 'Dokumentation'],
            'note' => 'Inklusive zwei Korrekturschleifen.',
            'optional' => ['Wartung & Updates', 'Monatlich, inklusive Monitoring'],
            'units' => ['hour' => ['Stunde', 'Std.'], 'day' => ['Tag', 'Tage'], 'piece' => ['Stück', 'Stk.'], 'flat' => ['Pauschal', 'Psch.'], 'month' => ['Monat', 'Mon.']],
            'contact' => ['Frau', 'Leitung E-Commerce'],
        ],
        'en' => [
            'invoice_intro' => "Hello {{ contact.first_name }},\nthank you for working with us. We invoice the following services:",
            'invoice_closing' => "Please transfer the amount by {{ document.due_date | date }}.\nKind regards",
            'offer_intro' => "Hello {{ contact.first_name }},\nas discussed, we offer the following services:",
            'offer_closing' => 'We look forward to hearing from you.',
            'items' => [['Concept', 'Workshop with minutes', '1', 'flat', '890'], ['Design', 'Home page and sub pages', '3', 'day', '760'], ['Development', 'Frontend and backend', '24', 'hour', '95']],
            'groups' => ['Concept', 'Design', 'Development', 'Operations'],
            'tasks' => ['Alignment', 'Research', 'Draft', 'Implementation', 'Testing', 'Documentation'],
            'note' => 'Includes two rounds of revisions.',
            'optional' => ['Maintenance & updates', 'Monthly, including monitoring'],
            'units' => ['hour' => ['Hour', 'h'], 'day' => ['Day', 'd'], 'piece' => ['Piece', 'pc'], 'flat' => ['Flat rate', 'flat'], 'month' => ['Month', 'mo']],
            'contact' => ['Ms', 'Head of e-commerce'],
        ],
    ];

    public function make(RenderScenario $scenario, string $locale): SampleData
    {
        $locale = array_key_exists($locale, self::TEXT) ? $locale : 'en';
        $text = self::TEXT[$locale];
        $type = $scenario->documentType();
        $offer = $type === DocumentType::Offer;
        $definitions = SnapshotBuilder::fieldDefinitionRows();

        $sources = [
            'org' => $this->org($scenario, $definitions),
            'customer' => $this->customer($scenario, $locale, $definitions),
            'contact' => [
                'id' => 'sample-contact', 'salutation' => $text['contact'][0], 'first_name' => 'Mira', 'last_name' => 'Albers',
                'position' => $text['contact'][1], 'email' => 'mira.albers@hafenkontor.example', 'phone' => '+49 40 555 0101',
                'custom' => self::custom($definitions, FieldScope::Contact, null),
            ],
            'tax_rates' => [
                ['id' => 'sample-vat-19', 'label' => '19 %', 'percent' => '19.00', 'category' => 'S', 'exemption_note' => null, 'archived' => false],
                ['id' => 'sample-vat-7', 'label' => '7 %', 'percent' => '7.00', 'category' => 'S', 'exemption_note' => null, 'archived' => false],
            ],
            'units' => array_map(fn (string $key): array => [
                'id' => "sample-unit-{$key}", 'name' => $text['units'][$key][0], 'symbol' => $text['units'][$key][1],
                'decimals' => self::UNITS[$key][1], 'code' => self::UNITS[$key][0], 'archived' => false,
            ], array_keys(self::UNITS)),
            'template' => null,
            'field_definitions' => $definitions,
            'legal_notes' => LegalNoteTexts::toArray(LegalNoteTexts::for($locale)),
        ];

        $document = new Document;
        $document->forceFill([
            'type' => $type,
            'status' => DocumentStatus::Open,
            'number' => $offer ? 'Q-2026-0042' : 'INV-2026-0042',
            'date' => self::DATE,
            'service_date' => $offer ? null : '2026-09-30',
            'due_date' => $offer ? null : '2026-10-15',
            'valid_until' => $offer ? '2026-10-31' : null,
            'intro' => $text[$offer ? 'offer_intro' : 'invoice_intro'],
            'closing' => $text[$offer ? 'offer_closing' : 'invoice_closing'],
            'locale' => $locale,
            'custom' => self::custom($definitions, FieldScope::Document, $type),
        ]);
        $document->id = 'sample-'.$scenario->value;
        $document->setRelation('groups', new Collection($this->groups($scenario, $text, self::custom($definitions, FieldScope::Position, $type))));

        return new SampleData($document, $sources);
    }

    /**
     * @param  list<array<string, mixed>>  $definitions
     * @return array<string, mixed>
     */
    private function org(RenderScenario $scenario, array $definitions): array
    {
        $org = SnapshotBuilder::orgRow(Organization::current());
        if (trim((string) $org['name']) === '') {
            $org = [...$org, ...self::ORG];
        }
        $org['custom'] = [...self::custom($definitions, FieldScope::Org, null), ...$org['custom']];
        $org['taxation_mode'] = $scenario === RenderScenario::SmallBusiness ? TaxationMode::SmallBusiness->value : TaxationMode::Regular->value;

        return $org;
    }

    /**
     * @param  list<array<string, mixed>>  $definitions
     * @return array<string, mixed>
     */
    private function customer(RenderScenario $scenario, string $locale, array $definitions): array
    {
        $customer = $scenario === RenderScenario::ReverseCharge
            ? ['number' => 'K-1003', 'name' => 'Hotel Alpenglück', 'street' => 'Bergweg 7', 'zip' => '6020', 'city' => 'Innsbruck', 'country' => 'AT', 'email' => 'office@alpenglueck.example', 'vat_id' => 'ATU12345678', 'tax_treatment' => 'eu_reverse_charge']
            : ['number' => 'K-1001', 'name' => 'Hafenkontor Lindqvist GmbH', 'street' => 'Am Sandtorkai 4', 'zip' => '20457', 'city' => 'Hamburg', 'country' => 'DE', 'email' => 'buchhaltung@hafenkontor.example', 'vat_id' => 'DE987654321', 'tax_treatment' => 'domestic'];

        return ['id' => 'sample-customer', ...$customer, 'locale' => $locale, 'custom' => self::custom($definitions, FieldScope::Customer, null)];
    }

    /**
     * @param  array<string, mixed>  $text
     * @param  array<string, mixed>  $custom  sample values of the position fields
     * @return list<PositionGroup>
     */
    private function groups(RenderScenario $scenario, array $text, array $custom): array
    {
        $line = fn (string $title, string $description, string $quantity, string $unit, string $price, PositionKind $kind = PositionKind::Item): array => ['title' => $title, 'description' => $description, 'quantity' => $quantity, 'unit' => $unit, 'price' => $price, 'kind' => $kind];
        $items = array_map(fn (array $i): array => $line(...$i), $text['items']);
        $note = $line($text['note'], '', '0', 'hour', '0', PositionKind::Text);

        $rows = match ($scenario) {
            RenderScenario::LongInvoice => array_map(fn (int $g): array => [
                'title' => $text['groups'][$g],
                'positions' => [
                    ...array_map(fn (int $i): array => $line(
                        $text['tasks'][($g * 12 + $i) % 6].' '.($i + 1), '', (string) (($i % 5) + 1), 'hour', (string) (80 + 5 * ($i % 4)),
                    ), range(0, 11)),
                    ...($g === 1 ? [$note] : []),
                ],
            ], range(0, 3)),
            RenderScenario::OfferWithOptions => [
                ['title' => $text['groups'][0], 'positions' => [$items[0], $items[1], $note]],
                ['title' => $text['groups'][3], 'positions' => [$items[2], $line($text['optional'][0], $text['optional'][1], '12', 'month', '149', PositionKind::Optional)]],
            ],
            default => [['title' => null, 'positions' => $items]],
        };

        $groups = [];
        foreach ($rows as $g => $row) {
            $group = new PositionGroup(['title' => $row['title'], 'sort' => $g]);
            $group->id = "sample-group-{$g}";
            $positions = [];
            foreach ($row['positions'] as $p => $data) {
                $isText = $data['kind'] === PositionKind::Text;
                $position = new Position([
                    'kind' => $data['kind'],
                    'title' => $data['title'],
                    'description' => $data['description'],
                    'quantity' => $data['quantity'],
                    'unit_price' => $data['price'],
                    'unit_id' => $isText ? null : 'sample-unit-'.$data['unit'],
                    'tax_rate_id' => $isText ? null : 'sample-vat-19',
                    'custom' => $isText ? [] : $custom,
                    'sort' => $p,
                ]);
                $position->id = "sample-position-{$g}-{$p}";
                $positions[] = $position;
            }
            $group->setRelation('positions', new Collection($positions));
            $groups[] = $group;
        }

        return $groups;
    }

    /**
     * Sample values for the custom fields of one level: default value, else a value by type.
     *
     * @param  list<array<string, mixed>>  $definitions  SnapshotBuilder::fieldDefinitionRows()
     * @return array<string, mixed>
     */
    private static function custom(array $definitions, FieldScope $scope, ?DocumentType $type): array
    {
        $values = [];
        foreach (FieldRegistry::forScope(DomainMapper::fieldDefinitions($definitions), $scope, $type) as $definition) {
            $values[$definition->key] = $definition->defaultValue ?? match ($definition->type) {
                FieldType::Text => $definition->label,
                FieldType::Textarea => $definition->label."\n".$definition->label,
                FieldType::Number => '42',
                FieldType::Money => '1250.00',
                FieldType::Date => self::DATE,
                FieldType::Select => $definition->options[0] ?? '',
                FieldType::Boolean => true,
                FieldType::Image => '',
            };
        }

        return $values;
    }
}
