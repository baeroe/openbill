<?php

use App\Actions\CreateDocument;
use App\Enums\DocumentType;
use App\Models\Customer;
use App\Models\Document;
use App\Models\Organization;
use App\Models\TaxRate;
use App\Models\Unit;
use App\Support\Actor;
use App\Support\GroupWriter;
use Illuminate\Foundation\Testing\DatabaseMigrations;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\FeatureTestCase;
use Tests\TestCase;

/*
 * Feature tests boot Laravel and run against the MariaDB database `testing`.
 * Unit tests are plain PHP (domain, architecture, file consistency) and don't boot the app.
 * Gotenberg is faked and the archive/local disks are fake disks (`Tests\FeatureTestCase`).
 */
pest()->extend(FeatureTestCase::class)->use(RefreshDatabase::class)->in('Feature');

/*
 * Integration tests need committed data (other processes and connections must see it), so they
 * migrate per test instead of wrapping it in a transaction. DatabaseMigrations resets
 * RefreshDatabaseState afterwards, so later Feature tests migrate again.
 */
pest()->extend(TestCase::class)->use(DatabaseMigrations::class)->in('Integration');

function systemActor(): Actor
{
    return Actor::system();
}

/** The "Hour" unit from the default master data. */
function hourUnitId(): string
{
    return (string) Unit::query()->where('code', 'HUR')->value('id');
}

/** A tax rate from the default master data by percent ("19.00", "7.00", "0.00"). */
function vatRateId(string $percent = '19.00'): string
{
    return (string) TaxRate::query()->where('percent', $percent)->value('id');
}

/**
 * A billable position row as actions and GroupWriter take it.
 *
 * @param  array<string, mixed>  $extra
 * @return array<string, mixed>
 */
function itemRow(string $title = 'Consulting', string $quantity = '1', string $price = '100', array $extra = []): array
{
    return [...[
        'kind' => 'item',
        'title' => $title,
        'description' => '',
        'quantity' => $quantity,
        'unit_price' => $price,
        'unit_id' => hourUnitId(),
        'tax_rate_id' => vatRateId(),
        'custom' => [],
    ], ...$extra];
}

/**
 * Draft built directly on the models (no actions, no events): one loose group with $positions.
 *
 * @param  list<array<string, mixed>>  $positions
 * @param  array<string, mixed>  $attributes
 */
function draftDocument(DocumentType $type = DocumentType::Invoice, array $positions = [], array $attributes = []): Document
{
    $document = Document::factory()->type($type)->create($attributes);
    GroupWriter::replace($document, [['title' => null, 'positions' => $positions]]);

    return $document->fresh(['groups.positions']);
}

/**
 * Draft created through CreateDocument for a new customer, with one loose group holding $positions
 * (one 100.00 consulting item when empty).
 *
 * @param  list<array<string, mixed>>  $positions
 * @param  array<string, mixed>  $input  extra CreateDocument/UpdateDraft input
 */
function draft(DocumentType $type = DocumentType::Invoice, array $positions = [], array $input = []): Document
{
    return app(CreateDocument::class)->handle(systemActor(), [
        'type' => $type->value,
        'customer_id' => Customer::factory()->create()->id,
        'groups' => [['title' => null, 'positions' => $positions === [] ? [itemRow()] : $positions]],
        ...$input,
    ]);
}

/** Organization data the EN 16931 profile requires (fictional). */
function completeOrganization(): void
{
    Organization::current()->forceFill([
        'name' => 'Studio Nordlicht', 'street' => 'Speicherstraße 12', 'zip' => '20457', 'city' => 'Hamburg', 'country' => 'DE',
        'vat_id' => 'DE123456789', 'iban' => 'DE02120300000000202051',
    ])->save();
}
