<?php

use App\Actions\FinalizeDocument;
use App\Enums\DocumentStatus;
use App\Enums\DocumentType;
use App\Models\Contact;
use App\Models\Customer;
use App\Models\Document;
use App\Models\DocumentSnapshot;
use App\Models\FieldDefinition;
use App\Models\Organization;
use App\Models\Template;
use App\Models\User;
use Database\Seeders\DemoSeeder;

it('seeds the demo data from the clickdummy', function () {
    $this->seed(DemoSeeder::class);

    expect(Organization::current()->name)->toBe('Studio Nordlicht')
        ->and(Customer::query()->orderBy('number')->pluck('name')->all())
        ->toBe(['Hafenkontor Lindqvist GmbH', 'Fjord Analytics AB', 'Hotel Alpenglück', 'Kulturwerk Elbinsel e. V.'])
        ->and(Contact::query()->count())->toBe(5)
        ->and(FieldDefinition::query()->count())->toBe(8)
        ->and(Template::query()->orderBy('slug')->pluck('slug')->all())->toBe(['kante', 'klar', 'leise'])
        ->and(Document::query()->count())->toBe(8)
        ->and(Document::query()->whereNotNull('finalized_at')->count())->toBe(6)
        ->and(DocumentSnapshot::query()->count())->toBe(6)
        ->and(Document::query()->where('status', DocumentStatus::Draft)->count())->toBe(2);
});

it('stores totals computed by the domain', function () {
    $this->seed(DemoSeeder::class);
    $year = now()->format('Y');

    $paid = Document::query()->where('number', "RE-{$year}-0041")->firstOrFail();
    $reverseCharge = Document::query()->where('number', "RE-{$year}-0040")->firstOrFail();
    $offer = Document::query()->where('number', "AN-{$year}-0001")->firstOrFail();

    // 24 h × 95 + 49 hosting = 2329.00 net, 19 % VAT
    expect($paid->status)->toBe(DocumentStatus::Paid)
        ->and($paid->paid_at)->not->toBeNull()
        ->and($paid->net_total)->toBe('2329.00')
        ->and($paid->gross_total)->toBe('2771.51')
        // EU reverse charge: no VAT
        ->and($reverseCharge->gross_total)->toBe('1320.00')
        // 890 + 3 × 760 + 52 × 95 = 8110.00; the optional maintenance does not count
        ->and($offer->net_total)->toBe('8110.00')
        ->and($offer->snapshot?->data['org']['name'])->toBe('Studio Nordlicht');
});

it('keeps users and can run twice; the number ranges continue', function () {
    $user = User::factory()->create();

    $this->seed(DemoSeeder::class);
    $this->seed(DemoSeeder::class);

    $draftOffer = Document::query()->where('type', DocumentType::Offer)->where('status', DocumentStatus::Draft)->firstOrFail();
    $draftInvoice = Document::query()->where('type', DocumentType::Invoice)->where('status', DocumentStatus::Draft)->firstOrFail();
    $year = now()->format('Y');

    expect(User::query()->whereKey($user->id)->exists())->toBeTrue()
        ->and(Document::query()->count())->toBe(8)
        ->and(app(FinalizeDocument::class)->handle(systemActor(), $draftOffer)->number)->toBe("AN-{$year}-0004")
        ->and($draftInvoice->source_id)->not->toBeNull();
});
