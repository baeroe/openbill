<?php

use App\Actions\FinalizeDocument;
use App\Enums\DocumentStatus;
use App\Enums\DocumentType;
use App\Models\Contact;
use App\Models\Customer;
use App\Models\Document;
use App\Models\DocumentFile;
use App\Models\DocumentSnapshot;
use App\Models\FieldDefinition;
use App\Models\Organization;
use App\Models\Template;
use App\Models\User;
use Database\Seeders\DemoSeeder;
use Illuminate\Support\Facades\Storage;

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

it('refuses to run in production', function () {
    app()->detectEnvironment(fn (): string => 'production');

    expect(fn () => app(DemoSeeder::class)->run())->toThrow(RuntimeException::class)
        ->and(Organization::current()->name)->not->toBe('Studio Nordlicht');
});

it('archives a PDF for every finalized demo document and the XML for e-invoices', function () {
    $this->seed(DemoSeeder::class);

    $finalized = Document::query()->whereNotNull('finalized_at');
    expect(DocumentFile::query()->where('kind', 'pdf')->count())->toBe((clone $finalized)->count())
        ->and(DocumentFile::query()->where('kind', 'xml')->count())->toBe((clone $finalized)->whereIn('type', ['invoice', 'cancellation'])->count());
    foreach (DocumentFile::all() as $file) {
        Storage::disk('archive')->assertExists($file->path);
    }
});

it('removes the archive files of the previous demo data', function () {
    $this->seed(DemoSeeder::class);
    $old = Storage::disk('archive')->allFiles();
    $this->seed(DemoSeeder::class);

    expect(array_intersect($old, Storage::disk('archive')->allFiles()))->toBe([])
        ->and(count(Storage::disk('archive')->allFiles()))->toBe(DocumentFile::query()->count());
});

it('lets the demo invoice draft be finalized as e-invoice', function () {
    $this->seed(DemoSeeder::class);
    $draft = Document::query()->where('type', DocumentType::Invoice)->where('status', DocumentStatus::Draft)->firstOrFail();

    $done = app(FinalizeDocument::class)->handle(systemActor(), $draft);

    expect($done->status)->toBe(DocumentStatus::Open)
        ->and($done->files->map(fn (DocumentFile $file): string => $file->kind->value)->sort()->values()->all())->toBe(['pdf', 'xml']);
});
