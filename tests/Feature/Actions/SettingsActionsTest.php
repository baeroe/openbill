<?php

use App\Actions\ArchiveTaxRate;
use App\Actions\ArchiveUnit;
use App\Actions\DeleteTextBlock;
use App\Actions\SaveTaxRate;
use App\Actions\SaveTextBlock;
use App\Actions\SaveUnit;
use App\Actions\UpdateDocumentType;
use App\Actions\UpdateOrganization;
use App\Enums\ComplianceProfile;
use App\Enums\DocumentType;
use App\Enums\FieldScope;
use App\Enums\TaxationMode;
use App\Enums\TaxCategory;
use App\Enums\TextBlockKind;
use App\Models\DocumentTypeSetting;
use App\Models\FieldDefinition;
use App\Models\NumberSequence;
use App\Models\TaxRate;
use App\Models\TextBlock;
use App\Models\Unit;
use Illuminate\Validation\ValidationException;

/** @return list<string> */
function settingsErrorPaths(Closure $run): array
{
    try {
        $run();
    } catch (ValidationException $e) {
        return array_keys($e->errors());
    }

    return [];
}

it('updates the organization and normalizes empty strings', function () {
    $org = app(UpdateOrganization::class)->handle(systemActor(), [
        'name' => 'Studio Nordlicht', 'country' => 'de', 'vat_id' => null, 'taxation_mode' => 'small_business', 'locale' => 'de',
    ]);

    expect($org->name)->toBe('Studio Nordlicht')
        ->and($org->country)->toBe('DE')
        ->and($org->vat_id)->toBe('')
        ->and($org->taxation_mode)->toBe(TaxationMode::SmallBusiness)
        ->and($org->locale)->toBe('de');
});

it('validates organization custom fields and enforces required ones', function () {
    FieldDefinition::factory()->create(['scope' => FieldScope::Org, 'key' => 'register', 'label' => 'Register', 'required' => true, 'doc_types' => []]);

    expect(settingsErrorPaths(fn () => app(UpdateOrganization::class)->handle(systemActor(), ['custom' => ['register' => '', 'motto' => 'x']])))
        ->toBe(['custom.motto', 'custom.register']);
});

it('updates a document type and its number range', function () {
    $intro = TextBlock::factory()->create(['kind' => TextBlockKind::Intro]);

    $setting = app(UpdateDocumentType::class)->handle(systemActor(), DocumentType::Invoice, [
        'profile' => 'en16931',
        'payment_term_days' => 30,
        'default_intro_block_id' => $intro->id,
        'numbering' => ['pattern' => 'RE-{YYYY}-{00000}', 'next_value' => 43],
    ]);

    $year = (int) now()->format('Y');
    expect($setting->profile)->toBe(ComplianceProfile::En16931)
        ->and($setting->payment_term_days)->toBe(30)
        ->and($setting->default_intro_block_id)->toBe($intro->id)
        ->and(NumberSequence::query()->where('doc_type', 'invoice')->whereNull('year')->value('pattern'))->toBe('RE-{YYYY}-{00000}')
        ->and(NumberSequence::query()->where('doc_type', 'invoice')->where('year', $year)->value('next_value'))->toBe(43);
});

it('keeps one running counter without yearly reset', function () {
    app(UpdateDocumentType::class)->handle(systemActor(), DocumentType::Offer, ['numbering' => ['pattern' => 'AN-{0000}', 'reset_yearly' => false, 'next_value' => 7]]);

    $config = NumberSequence::query()->where('doc_type', 'offer')->whereNull('year')->firstOrFail();
    expect($config->reset_yearly)->toBeFalse()
        ->and($config->next_value)->toBe(7);
});

it('refuses e-invoice profiles for offers, patterns without counter and yearly reset without year', function () {
    expect(settingsErrorPaths(fn () => app(UpdateDocumentType::class)->handle(systemActor(), DocumentType::Offer, ['profile' => 'en16931'])))->toBe(['profile'])
        ->and(settingsErrorPaths(fn () => app(UpdateDocumentType::class)->handle(systemActor(), DocumentType::Invoice, ['numbering' => ['pattern' => 'RE-{YYYY}']])))->toBe(['numbering.pattern'])
        ->and(settingsErrorPaths(fn () => app(UpdateDocumentType::class)->handle(systemActor(), DocumentType::Invoice, ['numbering' => ['pattern' => 'RE-{0000}', 'reset_yearly' => true]])))->toBe(['numbering.pattern'])
        ->and(NumberSequence::query()->where('doc_type', 'invoice')->whereNull('year')->value('pattern'))->toBe('INV-{YYYY}-{0000}')
        ->and(DocumentTypeSetting::query()->findOrFail('offer')->profile)->toBe(ComplianceProfile::Basic);
});

it('saves and archives tax rates; percent must be a decimal string between 0 and 100', function () {
    $rate = app(SaveTaxRate::class)->handle(systemActor(), ['label' => '10,7 %', 'percent' => '10.7', 'category' => 'S']);

    expect($rate->percent)->toBe('10.70')
        ->and($rate->category)->toBe(TaxCategory::S)
        ->and($rate->sort)->toBe(3)
        ->and(app(ArchiveTaxRate::class)->handle(systemActor(), $rate)->archived_at)->not->toBeNull()
        ->and(TaxRate::query()->whereKey($rate->id)->exists())->toBeTrue()
        ->and(settingsErrorPaths(fn () => app(SaveTaxRate::class)->handle(systemActor(), ['label' => 'X', 'percent' => 19.5, 'category' => 'S'])))->toBe(['percent'])
        ->and(settingsErrorPaths(fn () => app(SaveTaxRate::class)->handle(systemActor(), ['label' => 'X', 'percent' => '120', 'category' => 'S'])))->toBe(['percent'])
        ->and(settingsErrorPaths(fn () => app(SaveTaxRate::class)->handle(systemActor(), ['label' => 'X', 'percent' => '7', 'category' => 'VAT'])))->toBe(['category']);
});

it('saves and archives units with UN/ECE codes', function () {
    $unit = app(SaveUnit::class)->handle(systemActor(), ['name' => 'Woche', 'symbol' => 'Wo.', 'decimals' => 0, 'code' => 'WEE']);

    expect($unit->code)->toBe('WEE')
        ->and(app(ArchiveUnit::class)->handle(systemActor(), $unit)->archived_at)->not->toBeNull()
        ->and(settingsErrorPaths(fn () => app(SaveUnit::class)->handle(systemActor(), ['name' => 'X', 'code' => 'week'])))->toBe(['code'])
        ->and(Unit::query()->count())->toBe(7);
});

it('saves text blocks and clears document type defaults when one is deleted', function () {
    $block = app(SaveTextBlock::class)->handle(systemActor(), ['name' => 'Intro', 'kind' => 'intro', 'body' => 'Hello {{ contact.first_name }},']);
    DocumentTypeSetting::query()->whereKey('offer')->update(['default_intro_block_id' => $block->id]);

    app(DeleteTextBlock::class)->handle(systemActor(), $block);

    expect(TextBlock::query()->count())->toBe(0)
        ->and(DocumentTypeSetting::query()->findOrFail('offer')->default_intro_block_id)->toBeNull();
});
