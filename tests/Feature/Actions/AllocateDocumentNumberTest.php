<?php

use App\Actions\AllocateDocumentNumber;
use App\Enums\DocumentType;
use App\Models\Document;
use App\Models\NumberSequence;
use Illuminate\Support\Facades\DB;

function configureInvoiceNumbers(string $pattern, bool $resetYearly, int $next = 1, array $years = []): void
{
    NumberSequence::query()->where('doc_type', 'invoice')->whereNotNull('year')->delete();
    NumberSequence::query()->where('doc_type', 'invoice')->whereNull('year')
        ->update(['pattern' => $pattern, 'reset_yearly' => $resetYearly, 'next_value' => $next]);
    foreach ($years as $year => $value) {
        NumberSequence::query()->create(['doc_type' => 'invoice', 'year' => $year, 'pattern' => $pattern, 'next_value' => $value, 'reset_yearly' => true]);
    }
}

function allocateInvoiceNumber(string $date): string
{
    return DB::transaction(fn () => app(AllocateDocumentNumber::class)->handle(DocumentType::Invoice, $date));
}

it('keeps separate counters per year when backdating', function () {
    configureInvoiceNumbers('RE-{YYYY}-{0000}', true, years: [2026 => 5, 2025 => 8]);

    expect(allocateInvoiceNumber('2025-12-30'))->toBe('RE-2025-0008')
        ->and(allocateInvoiceNumber('2026-10-04'))->toBe('RE-2026-0005')
        ->and(allocateInvoiceNumber('2026-10-05'))->toBe('RE-2026-0006');
});

it('starts a fresh year at 1', function () {
    configureInvoiceNumbers('{YYYY}-{000}', true, years: [2026 => 42]);

    expect(allocateInvoiceNumber('2025-06-01'))->toBe('2025-001')
        ->and(allocateInvoiceNumber('2026-01-02'))->toBe('2026-042');
});

it('uses one running counter without yearly reset', function () {
    configureInvoiceNumbers('RE-{0000}', false, 7);

    expect(allocateInvoiceNumber('2025-01-01'))->toBe('RE-0007')
        ->and(NumberSequence::query()->where('doc_type', 'invoice')->whereNull('year')->value('next_value'))->toBe(8);
});

it('skips numbers that are already taken after a manual change', function () {
    configureInvoiceNumbers('RE-{0000}', false, 3);
    Document::factory()->finalized()->create(['number' => 'RE-0003']);
    Document::factory()->finalized()->create(['number' => 'RE-0004']);

    expect(allocateInvoiceNumber('2026-10-11'))->toBe('RE-0005');
});

it('previews the next number without reserving it', function () {
    configureInvoiceNumbers('RE-{YYYY}-{0000}', true, years: [2026 => 12]);

    expect(app(AllocateDocumentNumber::class)->preview(DocumentType::Invoice, '2026-10-11'))->toBe('RE-2026-0012')
        ->and(app(AllocateDocumentNumber::class)->preview(DocumentType::Invoice, '2027-01-01'))->toBe('RE-2027-0001')
        ->and(allocateInvoiceNumber('2026-10-11'))->toBe('RE-2026-0012');
});
