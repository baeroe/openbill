<?php

namespace App\Actions;

use App\Domain\Money\Decimal;
use App\Enums\TaxCategory;
use App\Models\TaxRate;
use App\Rules\DecimalString;
use App\Support\Actor;
use App\Support\Text;
use Closure;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

final class SaveTaxRate
{
    /**
     * @param  array<string, mixed>  $input
     *
     * @throws ValidationException
     */
    public function handle(Actor $actor, array $input, ?TaxRate $rate = null): TaxRate
    {
        $required = $rate === null ? 'required' : 'sometimes';
        $data = Validator::make($input, [
            'label' => [$required, 'string', 'max:64'],
            'percent' => [$required, new DecimalString(2), function (string $attribute, mixed $value, Closure $fail): void {
                if (Decimal::isValid($value, 2) && (Decimal::of($value)->isNegative() || Decimal::of($value)->isGreaterThan(100))) {
                    $fail(Text::t('errors.percent_range'));
                }
            }],
            'category' => [$required, Rule::enum(TaxCategory::class)],
            'exemption_note' => ['sometimes', 'nullable', 'string', 'max:1000'],
            'sort' => ['sometimes', 'integer', 'min:0'],
        ])->validate();

        $rate ??= new TaxRate;
        $rate->fill($data);
        if (! $rate->exists && ! array_key_exists('sort', $data)) {
            $rate->sort = (int) TaxRate::query()->max('sort') + 1;
        }
        $rate->save();

        return $rate;
    }
}
