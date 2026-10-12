<?php

namespace App\Actions;

use App\Models\Unit;
use App\Support\Actor;
use App\Support\TrimmedInput;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\ValidationException;

final class SaveUnit
{
    /**
     * @param  array<string, mixed>  $input
     *
     * @throws ValidationException
     */
    public function handle(Actor $actor, array $input, ?Unit $unit = null): Unit
    {
        $input = TrimmedInput::strings($input, ['name', 'symbol', 'code']);
        $data = Validator::make($input, [
            'name' => [$unit === null ? 'required' : 'sometimes', 'string', 'max:64'],
            'symbol' => ['sometimes', 'nullable', 'string', 'max:16'],
            'decimals' => ['sometimes', 'integer', 'min:0', 'max:4'],
            'code' => ['sometimes', 'nullable', 'string', 'regex:/^[A-Z0-9]{2,3}$/'],
            'sort' => ['sometimes', 'integer', 'min:0'],
        ])->validate();

        $unit ??= new Unit;
        foreach ($data as $key => $value) {
            $unit->{$key} = in_array($key, ['symbol', 'code'], true) ? (string) ($value ?? '') : $value;
        }
        if (! $unit->exists && ! array_key_exists('sort', $data)) {
            $unit->sort = (int) Unit::query()->max('sort') + 1;
        }
        $unit->save();

        return $unit;
    }
}
