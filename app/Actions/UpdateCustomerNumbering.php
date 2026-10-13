<?php

namespace App\Actions;

use App\Support\Actor;
use App\Support\NumberRange;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\ValidationException;

/** PATCH /api/customer-numbering: pattern, reset_yearly and next value of the customer number range. */
final class UpdateCustomerNumbering
{
    /**
     * @param  array<string, mixed>  $input  pattern?, reset_yearly?, next_value?
     *
     * @throws ValidationException
     */
    public function handle(Actor $actor, array $input): void
    {
        $data = Validator::make($input, NumberRange::rules())->validate();

        DB::transaction(fn () => NumberRange::customer()->update($data));
    }
}
