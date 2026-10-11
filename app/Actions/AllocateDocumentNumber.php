<?php

namespace App\Actions;

use App\Domain\Numbering\NumberFormatter;
use App\Enums\DocumentType;
use App\Models\Document;
use App\Models\NumberSequence;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;
use LogicException;

/**
 * Hands out the next number of a range. The configuration row (year NULL) is locked with
 * SELECT … FOR UPDATE until the surrounding transaction ends, so parallel finalizations wait for
 * each other; a rollback (failed finalize) gives the number back.
 */
final class AllocateDocumentNumber
{
    public function handle(DocumentType $type, string $date): string
    {
        if (DB::transactionLevel() === 0) {
            throw new LogicException('AllocateDocumentNumber must run inside a database transaction.');
        }

        $day = CarbonImmutable::parse($date);
        $config = NumberSequence::query()->where('doc_type', $type->value)->whereNull('year')->lockForUpdate()->firstOrFail();

        $counter = $config;
        if ($config->reset_yearly) {
            $year = (int) $day->format('Y');
            $counter = NumberSequence::query()->where('doc_type', $type->value)->where('year', $year)->lockForUpdate()->first()
                ?? NumberSequence::query()->create([
                    'doc_type' => $type,
                    'year' => $year,
                    'pattern' => $config->pattern,
                    'next_value' => 1,
                    'reset_yearly' => true,
                ]);
        }

        // pattern or counter changed by hand: skip numbers that already exist instead of failing on the unique index
        do {
            $sequence = $counter->next_value;
            $number = NumberFormatter::format($config->pattern, $day, $sequence);
            $counter->next_value = $sequence + 1;
        } while (Document::query()->where('number', $number)->exists());

        $counter->save();

        return $number;
    }

    /** The counter value the next finalize on $date would use; nothing is locked or reserved. */
    public function nextValue(DocumentType $type, string $date): int
    {
        $config = NumberSequence::query()->where('doc_type', $type->value)->whereNull('year')->firstOrFail();

        return $config->reset_yearly
            ? (int) (NumberSequence::query()->where('doc_type', $type->value)->where('year', (int) CarbonImmutable::parse($date)->format('Y'))->value('next_value') ?? 1)
            : $config->next_value;
    }

    /** The number the next finalize on $date would get; nothing is locked or reserved. */
    public function preview(DocumentType $type, string $date): string
    {
        $config = NumberSequence::query()->where('doc_type', $type->value)->whereNull('year')->firstOrFail();

        return NumberFormatter::format($config->pattern, CarbonImmutable::parse($date), $this->nextValue($type, $date));
    }
}
