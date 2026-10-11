<?php

namespace Database\Seeders;

use App\Enums\DocumentStatus;
use App\Enums\DocumentType;
use App\Enums\FieldScope;
use App\Enums\FieldType;
use App\Enums\TaxationMode;
use App\Enums\TaxTreatment;
use App\Enums\TextBlockKind;
use App\Models\Contact;
use App\Models\Customer;
use App\Models\Document;
use App\Models\DocumentTypeSetting;
use App\Models\FieldDefinition;
use App\Models\NumberSequence;
use App\Models\Organization;
use App\Models\TaxRate;
use App\Actions\SyncBuiltInTemplates;
use App\Models\Template;
use App\Support\Actor;
use App\Models\TextBlock;
use App\Models\Unit;
use App\Support\DocumentInspector;
use App\Support\GroupWriter;
use App\Support\SnapshotBuilder;
use Carbon\CarbonImmutable;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use RuntimeException;

/**
 * Fictional demo data (Studio Nordlicht and its customers), ported from
 * prototypes/clickdummy-v2/src/api/seed.ts. Replaces all business data; users stay.
 *
 *   php artisan db:seed --class=DemoSeeder
 */
class DemoSeeder extends Seeder
{
    /** Business tables, emptied before seeding (users, sessions and the organization row stay). */
    private const TABLES = [
        'document_events', 'document_files', 'document_snapshots', 'positions', 'position_groups', 'documents',
        'contacts', 'customers', 'field_definitions', 'template_assets', 'templates', 'text_blocks',
        'tax_rates', 'units', 'number_sequences',
    ];

    /** @var array<string, string> */
    private array $units = [];

    /** @var array<int, string> tax rate id by percent (19, 7, 0) */
    private array $taxRates = [];

    private CarbonImmutable $today;

    public function __construct(
        private readonly DocumentInspector $inspector,
        private readonly SnapshotBuilder $snapshots,
        private readonly SyncBuiltInTemplates $builtInTemplates,
    ) {}

    public function run(): void
    {
        // the wipe deletes finalized invoices: never on a production installation, not even with --force
        if (app()->isProduction()) {
            throw new RuntimeException('DemoSeeder replaces all business data and does not run in production.');
        }

        $this->today = CarbonImmutable::today();

        DB::transaction(function (): void {
            $this->wipe();
            $this->organization();
            $templates = $this->templates();
            $blocks = $this->textBlocks();
            $this->masterData();
            $this->fieldDefinitions();
            $this->documentTypes($templates, $blocks);
            $customers = $this->customers();
            $this->documents($customers, $templates, $blocks);
        });
    }

    /** Deletes finalized documents too, so it switches the lock triggers off for this session (@openbill_unlock). */
    private function wipe(): void
    {
        DB::statement('SET @openbill_unlock = 1');
        try {
            Schema::withoutForeignKeyConstraints(function (): void {
                DB::table('document_types')->update(['template_id' => null, 'default_intro_block_id' => null, 'default_closing_block_id' => null]);
                foreach (self::TABLES as $table) {
                    DB::table($table)->delete();
                }
            });
        } finally {
            DB::statement('SET @openbill_unlock = NULL');
        }
    }

    private function organization(): void
    {
        Organization::current()->forceFill([
            'name' => 'Studio Nordlicht',
            'street' => 'Speicherstraße 12',
            'zip' => '20457',
            'city' => 'Hamburg',
            'country' => 'DE',
            'logo_path' => null,
            'vat_id' => 'DE123456789',
            'tax_number' => '',
            'iban' => 'DE02 1203 0000 0000 2020 51',
            'bic' => 'BYLADEM1001',
            'bank_name' => 'Demo Bank',
            'email' => 'hallo@nordlicht.example',
            'phone' => '+49 40 1234567',
            'website' => 'nordlicht.example',
            'taxation_mode' => TaxationMode::Regular,
            'locale' => 'de',
            'custom' => ['register' => 'Amtsgericht Hamburg HRB 000000'],
        ])->save();
    }

    /** @return array<string, string> slug => id */
    private function templates(): array
    {
        return array_map(fn (Template $template): string => $template->id, $this->builtInTemplates->handle(Actor::system()));
    }

    /** @return array<string, TextBlock> */
    private function textBlocks(): array
    {
        $blocks = [
            'offer_intro' => ['Angebot: Einleitung', TextBlockKind::Intro, "Hallo {{ contact.first_name }},\nvielen Dank für das gute Gespräch. Wie besprochen biete ich Ihnen folgende Leistungen an:"],
            'invoice_intro' => ['Rechnung: Einleitung', TextBlockKind::Intro, 'Vielen Dank für die gute Zusammenarbeit. Für das Projekt berechne ich Ihnen folgende Leistungen:'],
            'payment' => ['Zahlungsbedingungen', TextBlockKind::Payment, 'Bitte überweisen Sie den Betrag bis zum {{ document.due_date | date }} auf das unten genannte Konto.'],
            'closing' => ['Schlusstext', TextBlockKind::Closing, "Ich freue mich auf Ihre Rückmeldung.\nViele Grüße\nKai Behrens"],
        ];

        return array_map(
            fn (array $b): TextBlock => TextBlock::query()->create(['name' => $b[0], 'kind' => $b[1], 'body' => $b[2]]),
            $blocks,
        );
    }

    private function masterData(): void
    {
        foreach ([19 => ['19 %', '19.00', 'S'], 7 => ['7 %', '7.00', 'S'], 0 => ['0 %', '0.00', 'Z']] as $key => [$label, $percent, $category]) {
            $this->taxRates[$key] = TaxRate::query()->create([
                'label' => $label, 'percent' => $percent, 'category' => $category, 'sort' => count($this->taxRates),
            ])->id;
        }

        $units = [
            'hour' => ['Stunde', 'Std.', 2, 'HUR'],
            'day' => ['Tag', 'Tage', 1, 'DAY'],
            'piece' => ['Stück', 'Stk.', 0, 'H87'],
            'flat' => ['Pauschal', 'Psch.', 0, 'LS'],
            'month' => ['Monat', 'Mon.', 0, 'MON'],
        ];
        foreach ($units as $key => [$name, $symbol, $decimals, $code]) {
            $this->units[$key] = Unit::query()->create([
                'name' => $name, 'symbol' => $symbol, 'decimals' => $decimals, 'code' => $code, 'sort' => count($this->units),
            ])->id;
        }
    }

    private function fieldDefinitions(): void
    {
        $all = ['offer', 'confirmation', 'invoice', 'cancellation'];
        $fields = [
            [FieldScope::Org, 'register', 'Handelsregister', FieldType::Text, [], [], ''],
            [FieldScope::Customer, 'industry', 'Branche', FieldType::Select, [], ['Handel', 'Software', 'Hotellerie', 'Logistik', 'Kultur'], ''],
            [FieldScope::Customer, 'supplier_number', 'Unsere Lieferantennummer', FieldType::Text, [], [], 'Die Nummer, unter der uns der Kunde führt.'],
            [FieldScope::Contact, 'department', 'Abteilung', FieldType::Text, [], [], ''],
            [FieldScope::Document, 'project_name', 'Projektname', FieldType::Text, $all, [], ''],
            [FieldScope::Document, 'po_number', 'Bestellnummer des Kunden', FieldType::Text, ['confirmation', 'invoice'], [], 'Steht auf der Bestellung des Kunden und muss auf die Rechnung.'],
            [FieldScope::Document, 'response_time', 'Reaktionszeit', FieldType::Select, ['offer', 'confirmation'], ['24 Stunden', '48 Stunden', 'nächster Werktag'], ''],
            [FieldScope::Position, 'ticket', 'Ticket', FieldType::Text, ['invoice', 'cancellation'], [], 'Referenz aus dem Ticketsystem, z. B. SHOP-142.'],
        ];
        foreach ($fields as $sort => [$scope, $key, $label, $type, $docTypes, $options, $help]) {
            FieldDefinition::query()->create([
                'scope' => $scope, 'key' => $key, 'label' => $label, 'type' => $type, 'required' => false, 'default_value' => null,
                'help' => $help, 'options' => $options, 'doc_types' => $docTypes, 'sort' => $sort,
            ]);
        }
    }

    /**
     * @param  array<string, string>  $templates
     * @param  array<string, TextBlock>  $blocks
     */
    private function documentTypes(array $templates, array $blocks): void
    {
        $year = (int) $this->today->format('Y');
        $types = [
            'offer' => ['AN-{YYYY}-{0000}', 4, ['profile' => 'basic', 'template_id' => $templates['klar'], 'validity_days' => 30, 'payment_term_days' => null, 'default_intro_block_id' => $blocks['offer_intro']->id, 'default_closing_block_id' => $blocks['closing']->id]],
            'confirmation' => ['AB-{YYYY}-{0000}', 2, ['profile' => 'basic', 'template_id' => $templates['leise'], 'validity_days' => null, 'payment_term_days' => null]],
            'invoice' => ['RE-{YYYY}-{0000}', 42, ['profile' => 'en16931', 'template_id' => $templates['klar'], 'validity_days' => null, 'payment_term_days' => 14, 'default_intro_block_id' => $blocks['invoice_intro']->id, 'default_closing_block_id' => $blocks['payment']->id]],
            'cancellation' => ['ST-{YYYY}-{0000}', null, ['profile' => 'en16931', 'template_id' => $templates['klar'], 'validity_days' => null, 'payment_term_days' => null]],
        ];
        foreach ($types as $type => [$pattern, $next, $setting]) {
            DocumentTypeSetting::query()->whereKey($type)->update($setting);
            NumberSequence::query()->create(['doc_type' => $type, 'year' => null, 'pattern' => $pattern, 'next_value' => 1, 'reset_yearly' => true]);
            if ($next !== null) {
                NumberSequence::query()->create(['doc_type' => $type, 'year' => $year, 'pattern' => $pattern, 'next_value' => $next, 'reset_yearly' => true]);
            }
        }
    }

    /** @return array<string, array{customer: Customer, contact: Contact}> */
    private function customers(): array
    {
        $rows = [
            'hafenkontor' => [
                ['number' => 'K-1001', 'name' => 'Hafenkontor Lindqvist GmbH', 'street' => 'Am Sandtorkai 4', 'zip' => '20457', 'city' => 'Hamburg', 'country' => 'DE', 'email' => 'buchhaltung@hafenkontor.example', 'vat_id' => 'DE987654321', 'tax_treatment' => TaxTreatment::Domestic, 'custom' => ['industry' => 'Handel', 'supplier_number' => 'L-20931']],
                [
                    ['salutation' => 'Frau', 'first_name' => 'Mira', 'last_name' => 'Albers', 'position' => 'Leitung E-Commerce', 'email' => 'mira.albers@hafenkontor.example', 'phone' => '+49 40 555 0101', 'is_default' => true, 'custom' => ['department' => 'Digital']],
                    ['salutation' => 'Herr', 'first_name' => 'Ole', 'last_name' => 'Brandt', 'position' => 'Einkauf', 'email' => 'ole.brandt@hafenkontor.example', 'phone' => '', 'is_default' => false, 'custom' => ['department' => 'Einkauf']],
                ],
                -220,
            ],
            'fjord' => [
                ['number' => 'K-1002', 'name' => 'Fjord Analytics AB', 'street' => 'Storgatan 8', 'zip' => '111 51', 'city' => 'Stockholm', 'country' => 'SE', 'email' => 'invoices@fjord.example', 'vat_id' => 'SE556677889901', 'tax_treatment' => TaxTreatment::EuReverseCharge, 'custom' => ['industry' => 'Software']],
                [['salutation' => 'Frau', 'first_name' => 'Elin', 'last_name' => 'Berg', 'position' => 'CTO', 'email' => 'elin@fjord.example', 'phone' => '', 'is_default' => true, 'custom' => []]],
                -160,
            ],
            'alpen' => [
                ['number' => 'K-1003', 'name' => 'Hotel Alpenglück', 'street' => 'Bergweg 1', 'zip' => '87561', 'city' => 'Oberstdorf', 'country' => 'DE', 'email' => 'info@alpenglueck.example', 'vat_id' => '', 'tax_treatment' => TaxTreatment::Domestic, 'custom' => ['industry' => 'Hotellerie']],
                [['salutation' => 'Herr', 'first_name' => 'Max', 'last_name' => 'Huber', 'position' => 'Inhaber', 'email' => 'max@alpenglueck.example', 'phone' => '+49 8322 555 22', 'is_default' => true, 'custom' => []]],
                -90,
            ],
            'kulturwerk' => [
                ['number' => 'K-1004', 'name' => 'Kulturwerk Elbinsel e. V.', 'street' => 'Veringstraße 40', 'zip' => '21107', 'city' => 'Hamburg', 'country' => 'DE', 'email' => 'vorstand@kulturwerk.example', 'vat_id' => '', 'tax_treatment' => TaxTreatment::Domestic, 'custom' => ['industry' => 'Kultur']],
                [['salutation' => 'Frau', 'first_name' => 'Jana', 'last_name' => 'Okafor', 'position' => 'Vorstand', 'email' => 'jana@kulturwerk.example', 'phone' => '', 'is_default' => true, 'custom' => []]],
                -30,
            ],
        ];

        $result = [];
        foreach ($rows as $key => [$attributes, $contacts, $createdDaysAgo]) {
            $customer = Customer::query()->create($attributes);
            DB::table('customers')->where('id', $customer->id)->update(['created_at' => $this->stamp($createdDaysAgo), 'updated_at' => $this->stamp($createdDaysAgo)]);
            $first = null;
            foreach ($contacts as $contact) {
                $model = Contact::query()->create([...$contact, 'customer_id' => $customer->id]);
                $first ??= $model;
            }
            $result[$key] = ['customer' => $customer, 'contact' => $first];
        }

        return $result;
    }

    /**
     * @param  array<string, array{customer: Customer, contact: Contact}>  $c
     * @param  array<string, string>  $templates
     * @param  array<string, TextBlock>  $blocks
     */
    private function documents(array $c, array $templates, array $blocks): void
    {
        $year = $this->today->format('Y');
        $offerIntro = $blocks['offer_intro']->body;
        $invoiceIntro = $blocks['invoice_intro']->body;
        $closing = $blocks['closing']->body;
        $payment = $blocks['payment']->body;

        $offer1 = $this->document([
            'type' => DocumentType::Offer, 'status' => DocumentStatus::Accepted, 'number' => "AN-{$year}-0001", 'date' => $this->day(-48),
            'customer' => $c['hafenkontor'], 'valid_until' => $this->day(-18), 'intro' => $offerIntro, 'closing' => $closing,
            'template_id' => $templates['klar'], 'custom' => ['project_name' => 'Relaunch Online-Shop', 'response_time' => '48 Stunden'],
            'finalized_at' => $this->stamp(-48), 'created_at' => $this->stamp(-49), 'updated_at' => $this->stamp(-40),
        ], $this->shopGroups());

        $this->document([
            'type' => DocumentType::Invoice, 'status' => DocumentStatus::Draft, 'number' => null, 'date' => $this->day(0),
            'customer' => $c['hafenkontor'], 'due_date' => $this->day(14), 'intro' => $invoiceIntro, 'closing' => $payment,
            'template_id' => $templates['klar'], 'source_id' => $offer1->id, 'custom' => ['project_name' => 'Relaunch Online-Shop', 'po_number' => 'PO-77812'],
            'finalized_at' => null, 'created_at' => $this->stamp(-1), 'updated_at' => $this->stamp(0),
        ], array_map(fn (array $group): array => [
            ...$group,
            'positions' => array_map(fn (array $p): array => [...$p, 'custom' => $p['kind'] === 'item' ? ['ticket' => 'SHOP-142'] : []], $group['positions']),
        ], array_slice($this->shopGroups(), 0, 2)));

        $this->document([
            'type' => DocumentType::Offer, 'status' => DocumentStatus::Open, 'number' => "AN-{$year}-0002", 'date' => $this->day(-6),
            'customer' => $c['fjord'], 'valid_until' => $this->day(24), 'intro' => $offerIntro, 'closing' => $closing,
            'template_id' => $templates['kante'], 'custom' => ['project_name' => 'Dashboard-Audit'],
            'finalized_at' => $this->stamp(-6), 'created_at' => $this->stamp(-7), 'updated_at' => $this->stamp(-6),
        ], [['title' => null, 'positions' => [$this->position(['title' => 'UX-Audit Analytics-Dashboard', 'description' => 'Heuristische Analyse, Bericht mit Empfehlungen', 'quantity' => '16', 'unit_price' => '110'])]]]);

        $this->document([
            'type' => DocumentType::Offer, 'status' => DocumentStatus::Open, 'number' => "AN-{$year}-0003", 'date' => $this->day(-3),
            'customer' => $c['kulturwerk'], 'valid_until' => $this->day(27), 'intro' => $offerIntro, 'closing' => $closing,
            'template_id' => $templates['klar'], 'custom' => ['project_name' => 'Festival-Website 2027'],
            'finalized_at' => $this->stamp(-3), 'created_at' => $this->stamp(-4), 'updated_at' => $this->stamp(-3),
        ], [
            ['title' => 'Gestaltung', 'positions' => [$this->position(['title' => 'Designsystem & Startseite', 'quantity' => '4', 'unit_id' => $this->units['day'], 'unit_price' => '720'])]],
            ['title' => 'Umsetzung', 'positions' => [
                $this->position(['title' => 'Programmübersicht mit Filter', 'quantity' => '28']),
                $this->position(['title' => 'Ticket-Anbindung', 'quantity' => '12']),
            ]],
        ]);

        $this->document([
            'type' => DocumentType::Invoice, 'status' => DocumentStatus::Open, 'number' => "RE-{$year}-0040", 'date' => $this->day(-24),
            'customer' => $c['fjord'], 'service_date' => $this->day(-26), 'due_date' => $this->day(-10), 'intro' => $invoiceIntro, 'closing' => $payment,
            'template_id' => $templates['klar'], 'custom' => ['project_name' => 'Datenmodell'],
            'finalized_at' => $this->stamp(-24), 'created_at' => $this->stamp(-25), 'updated_at' => $this->stamp(-24),
        ], [['title' => null, 'positions' => [$this->position(['title' => 'Beratung Datenmodell', 'quantity' => '12', 'unit_price' => '110'])]]]);

        $this->document([
            'type' => DocumentType::Invoice, 'status' => DocumentStatus::Paid, 'number' => "RE-{$year}-0041", 'date' => $this->day(-15),
            'customer' => $c['alpen'], 'service_date' => $this->day(-17), 'due_date' => $this->day(-1), 'intro' => $invoiceIntro, 'closing' => $payment,
            'template_id' => $templates['klar'], 'custom' => ['project_name' => 'Buchungsstrecke'], 'paid_at' => $this->stamp(-4),
            'finalized_at' => $this->stamp(-15), 'created_at' => $this->stamp(-16), 'updated_at' => $this->stamp(-4),
        ], [
            ['title' => 'Entwicklung', 'positions' => [
                $this->position(['title' => 'Buchungsstrecke mobil', 'quantity' => '18']),
                $this->position(['title' => 'Anbindung Channel-Manager', 'quantity' => '6']),
            ]],
            ['title' => 'Betrieb', 'positions' => [$this->position(['title' => 'Hosting', 'unit_id' => $this->units['month'], 'quantity' => '1', 'unit_price' => '49'])]],
        ]);

        $this->document([
            'type' => DocumentType::Confirmation, 'status' => DocumentStatus::Open, 'number' => "AB-{$year}-0001", 'date' => $this->day(-40),
            'customer' => $c['hafenkontor'], 'intro' => 'Vielen Dank für Ihren Auftrag. Hiermit bestätige ich die folgenden Leistungen:', 'closing' => $closing,
            'template_id' => $templates['leise'], 'source_id' => $offer1->id,
            'custom' => ['project_name' => 'Relaunch Online-Shop', 'po_number' => 'PO-77812', 'response_time' => '48 Stunden'],
            'finalized_at' => $this->stamp(-40), 'created_at' => $this->stamp(-40), 'updated_at' => $this->stamp(-40),
        ], array_slice($this->shopGroups(), 0, 2));

        $this->document([
            'type' => DocumentType::Offer, 'status' => DocumentStatus::Draft, 'number' => null, 'date' => $this->day(0),
            'customer' => $c['alpen'], 'valid_until' => $this->day(30), 'intro' => $offerIntro, 'closing' => $closing,
            'template_id' => $templates['klar'], 'custom' => ['project_name' => 'Newsletter'],
            'finalized_at' => null, 'created_at' => $this->stamp(-2), 'updated_at' => $this->stamp(-2),
        ], [['title' => null, 'positions' => [$this->position(['title' => 'Newsletter-Vorlage', 'description' => 'Gestaltung und Umsetzung, responsiv', 'quantity' => '8'])]]]);
    }

    /**
     * Saves the document as a draft first (groups need an open document), computes the totals,
     * then freezes the master data and sets finalized_at for finalized ones.
     *
     * @param  array<string, mixed>  $a
     * @param  list<array<string, mixed>>  $groups
     */
    private function document(array $a, array $groups): Document
    {
        /** @var array{customer: Customer, contact: Contact} $party */
        $party = $a['customer'];
        $document = new Document;
        $document->forceFill([
            'type' => $a['type'],
            'status' => $a['status'],
            'number' => $a['number'],
            'date' => $a['date'],
            'customer_id' => $party['customer']->id,
            'contact_id' => $party['contact']->id,
            'service_date' => $a['service_date'] ?? null,
            'due_date' => $a['due_date'] ?? null,
            'valid_until' => $a['valid_until'] ?? null,
            'intro' => $a['intro'],
            'closing' => $a['closing'],
            'template_id' => $a['template_id'],
            'locale' => 'de',
            'custom' => $a['custom'],
            'source_id' => $a['source_id'] ?? null,
            'paid_at' => $a['paid_at'] ?? null,
        ])->save();

        GroupWriter::replace($document, $groups);
        $document->load('groups.positions');
        $this->inspector->applyTotals($document, $this->inspector->totals($document));
        $document->save();

        // timestamps in the same write as finalized_at: afterwards the lock allows no other column
        $data = $a['finalized_at'] !== null ? $this->snapshots->build($document) : null;
        $document->forceFill(['created_at' => $a['created_at'], 'updated_at' => $a['updated_at'], 'finalized_at' => $a['finalized_at']])->save();
        if ($data !== null) {
            $document->snapshot()->create(['data' => $data]);
        }

        return $document;
    }

    /** @return list<array<string, mixed>> */
    private function shopGroups(): array
    {
        return [
            ['title' => 'Konzept & UX', 'positions' => [
                $this->position(['title' => 'Discovery-Workshop', 'description' => 'Halbtags vor Ort, inklusive Protokoll', 'unit_id' => $this->units['flat'], 'unit_price' => '890']),
                $this->position(['title' => 'Wireframes & Klickpfade', 'quantity' => '3', 'unit_id' => $this->units['day'], 'unit_price' => '760']),
            ]],
            ['title' => 'Umsetzung', 'positions' => [
                $this->position(['title' => 'Frontend-Entwicklung', 'description' => 'Shop-Theme, Warenkorb, Checkout', 'quantity' => '52']),
                $this->position(['kind' => 'text', 'title' => 'Inklusive zwei Korrekturschleifen.', 'quantity' => '0', 'unit_id' => null, 'unit_price' => '0', 'tax_rate_id' => null]),
            ]],
            ['title' => 'Betrieb', 'positions' => [
                $this->position(['kind' => 'optional', 'title' => 'Wartung & Updates', 'description' => 'Monatlich, inklusive Monitoring', 'unit_id' => $this->units['month'], 'quantity' => '12', 'unit_price' => '149']),
            ]],
        ];
    }

    /**
     * @param  array<string, mixed>  $over
     * @return array<string, mixed>
     */
    private function position(array $over): array
    {
        return [...[
            'kind' => 'item',
            'title' => '',
            'description' => '',
            'quantity' => '1',
            'unit_id' => $this->units['hour'],
            'unit_price' => '95',
            'tax_rate_id' => $this->taxRates[19],
            'custom' => [],
        ], ...$over];
    }

    private function day(int $offset): string
    {
        return $this->today->addDays($offset)->toDateString();
    }

    private function stamp(int $offset): CarbonImmutable
    {
        return $this->today->addDays($offset)->setTime(9, 0);
    }
}
