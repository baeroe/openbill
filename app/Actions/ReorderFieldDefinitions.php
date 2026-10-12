<?php

namespace App\Actions;

use App\Enums\FieldScope;
use App\Models\FieldDefinition;
use App\Support\Actor;
use App\Support\Text;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

/** POST /api/field-definitions/reorder: the complete order of one level ({scope, ids}); all or nothing. */
final class ReorderFieldDefinitions
{
    /**
     * @param  array<string, mixed>  $input
     *
     * @throws ValidationException
     */
    public function handle(Actor $actor, array $input): void
    {
        $data = Validator::make($input, [
            'scope' => ['required', Rule::enum(FieldScope::class)],
            'ids' => ['required', 'array', 'list'],
            'ids.*' => ['string', 'distinct'],
        ])->validate();

        DB::transaction(function () use ($data): void {
            $existing = FieldDefinition::query()->where('scope', $data['scope'])->lockForUpdate()->pluck('id')->all();
            if (count($data['ids']) !== count($existing) || array_diff($data['ids'], $existing) !== []) {
                throw ValidationException::withMessages(['ids' => [Text::t('fields.reorder_mismatch')]]);
            }
            foreach ($data['ids'] as $sort => $id) {
                FieldDefinition::query()->whereKey($id)->update(['sort' => $sort]);
            }
        });
    }
}
