<?php

namespace App\Support;

use App\Domain\Numbering\NumberFormatter;
use App\Enums\DocumentType;
use App\Models\Customer;
use App\Models\Document;
use App\Models\NumberSequence;
use Carbon\CarbonImmutable;
use Closure;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use LogicException;

/**
 * One number range in number_sequences: a document type (key = type) or the customer numbers (key "customer").
 * The configuration row (year NULL) holds pattern, reset_yearly and the running counter without reset; with a yearly
 * reset there is one counter row per year. Numbers that exist already are skipped instead of failing on the unique index.
 */
final class NumberRange
{
    public const CUSTOMER = 'customer';

    /**
     * @param  Closure(string): bool  $taken
     * @param  int  $maxLength  length of the number column
     */
    private function __construct(private readonly string $key, private readonly Closure $taken, private readonly int $maxLength) {}

    public static function document(DocumentType $type): self
    {
        return new self($type->value, fn (string $number): bool => Document::query()->where('number', $number)->exists(), 64);
    }

    /** Deleted customers keep their number (unique index), so it is never handed out again. */
    public static function customer(): self
    {
        return new self(self::CUSTOMER, fn (string $number): bool => Customer::withTrashed()->where('number', $number)->exists(), 32);
    }

    /**
     * Validation rules for {pattern, reset_yearly, next_value}, keys prefixed with $prefix ("numbering." or "").
     *
     * @return array<string, list<string>>
     */
    public static function rules(string $prefix = ''): array
    {
        return [
            $prefix.'pattern' => ['sometimes', 'string', 'max:64', 'regex:/\{0+\}/'],
            $prefix.'reset_yearly' => ['sometimes', 'boolean'],
            $prefix.'next_value' => ['sometimes', 'integer', 'min:1', 'max:99999999'],
        ];
    }

    /**
     * Hands out the next number. The configuration row is locked with SELECT … FOR UPDATE until the surrounding
     * transaction ends, so parallel callers wait for each other; a rollback gives the number back.
     */
    public function allocate(CarbonImmutable $day): string
    {
        if (DB::transactionLevel() === 0) {
            throw new LogicException('A number range can only allocate inside a database transaction.');
        }

        $config = $this->config(lock: true);
        $counter = $config;
        if ($config->reset_yearly) {
            $year = (int) $day->format('Y');
            $counter = NumberSequence::query()->where('doc_type', $this->key)->where('year', $year)->lockForUpdate()->first()
                ?? NumberSequence::query()->create([
                    'doc_type' => $this->key,
                    'year' => $year,
                    'pattern' => $config->pattern,
                    'next_value' => 1,
                    'reset_yearly' => true,
                ]);
        }

        // pattern or counter changed by hand: skip numbers that already exist
        do {
            $sequence = $counter->next_value;
            $number = NumberFormatter::format($config->pattern, $day, $sequence);
            $counter->next_value = $sequence + 1;
        } while (($this->taken)($number));

        $counter->save();

        return $number;
    }

    /**
     * The counter value the next allocation on $day would use; nothing is locked or reserved. $resetYearly overrides
     * the saved setting (settings form with an unsaved checkbox).
     */
    public function nextValue(CarbonImmutable $day, ?bool $resetYearly = null): int
    {
        $config = $this->config();

        return ($resetYearly ?? $config->reset_yearly)
            ? (int) (NumberSequence::query()->where('doc_type', $this->key)->where('year', (int) $day->format('Y'))->value('next_value') ?? 1)
            : $config->next_value;
    }

    /**
     * First value from $sequence on whose number is still free – the same skip as allocate(), read-only.
     *
     * @return array{0: int, 1: string} value and number
     */
    public function firstFree(string $pattern, CarbonImmutable $day, int $sequence): array
    {
        while (($this->taken)($number = NumberFormatter::format($pattern, $day, $sequence))) {
            $sequence++;
        }

        return [$sequence, $number];
    }

    /** The number the next allocation on $day would get; nothing is locked or reserved. */
    public function preview(CarbonImmutable $day): string
    {
        return $this->firstFree($this->config()->pattern, $day, $this->nextValue($day))[1];
    }

    /**
     * The saved settings as the API shows them.
     *
     * @return array{pattern: string, reset_yearly: bool, next_value: int, next_number: string}
     */
    public function describe(CarbonImmutable $day): array
    {
        $config = $this->config();

        return [
            'pattern' => $config->pattern,
            'reset_yearly' => $config->reset_yearly,
            'next_value' => $this->nextValue($day),
            'next_number' => $this->preview($day),
        ];
    }

    /**
     * The next number for an unsaved pattern (settings form). Problems come back as message instead of an exception,
     * so the preview can explain them.
     *
     * @return array{number: string|null, valid: bool, message: string|null}
     */
    public function check(string $pattern, bool $resetYearly, ?int $nextValue, CarbonImmutable $day): array
    {
        if (! NumberFormatter::isValidPattern($pattern)) {
            return ['number' => null, 'valid' => false, 'message' => Text::t('errors.number_pattern_sequence')];
        }
        if ($resetYearly && ! NumberFormatter::hasYear($pattern)) {
            return ['number' => null, 'valid' => false, 'message' => Text::t('errors.number_pattern_year')];
        }
        $sequence = $nextValue ?? $this->nextValue($day, $resetYearly);
        $wanted = NumberFormatter::format($pattern, $day, $sequence);
        if (mb_strlen($wanted) > $this->maxLength) {
            return ['number' => null, 'valid' => false, 'message' => Text::t('errors.number_too_long', ['max' => $this->maxLength])];
        }
        [, $number] = $this->firstFree($pattern, $day, $sequence);

        return [
            'number' => $number,
            'valid' => true,
            'message' => $number === $wanted ? null : Text::t($this->key === self::CUSTOMER ? 'settings.customer_number_taken' : 'settings.number_taken', ['number' => $wanted, 'next' => $number]),
        ];
    }

    /**
     * Saves validated {pattern?, reset_yearly?, next_value?} (see rules()); errors at "$prefix.pattern".
     *
     * @param  array<string, mixed>  $input
     *
     * @throws ValidationException
     */
    public function update(array $input, string $prefix = ''): void
    {
        $config = $this->config(lock: true);
        $pattern = (string) ($input['pattern'] ?? $config->pattern);
        $resetYearly = array_key_exists('reset_yearly', $input) ? (bool) $input['reset_yearly'] : $config->reset_yearly;

        // a yearly reset without the year in the pattern would hand out the same number every year
        if ($resetYearly && ! NumberFormatter::hasYear($pattern)) {
            throw ValidationException::withMessages([$prefix.'pattern' => [Text::t('errors.number_pattern_year')]]);
        }

        $sample = NumberFormatter::format($pattern, CarbonImmutable::now(), (int) ($input['next_value'] ?? $this->nextValue(CarbonImmutable::now(), $resetYearly)));
        if (mb_strlen($sample) > $this->maxLength) {
            throw ValidationException::withMessages([$prefix.'pattern' => [Text::t('errors.number_too_long', ['max' => $this->maxLength])]]);
        }

        $config->forceFill(['pattern' => $pattern, 'reset_yearly' => $resetYearly]);
        if (isset($input['next_value'])) {
            if ($resetYearly) {
                NumberSequence::query()->updateOrCreate(
                    ['doc_type' => $this->key, 'year' => (int) now()->format('Y')],
                    ['pattern' => $pattern, 'reset_yearly' => true, 'next_value' => (int) $input['next_value']],
                );
            } else {
                $config->next_value = (int) $input['next_value'];
            }
        }
        $config->save();
    }

    private function config(bool $lock = false): NumberSequence
    {
        return NumberSequence::query()->where('doc_type', $this->key)->whereNull('year')
            ->when($lock, fn ($query) => $query->lockForUpdate())
            ->firstOrFail();
    }
}
