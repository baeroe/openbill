<?php

namespace App\Actions;

use App\Enums\ComplianceProfile;
use App\Enums\DocumentType;
use App\Models\DocumentTypeSetting;
use App\Support\Actor;
use App\Support\NumberRange;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

final class UpdateDocumentType
{
    /**
     * @param  array<string, mixed>  $input
     *
     * @throws ValidationException
     */
    public function handle(Actor $actor, DocumentType $type, array $input): DocumentTypeSetting
    {
        $profiles = in_array($type, [DocumentType::Invoice, DocumentType::Cancellation], true)
            ? [ComplianceProfile::Basic->value, ComplianceProfile::En16931->value]
            : [ComplianceProfile::Basic->value];

        $data = Validator::make($input, [
            'profile' => ['sometimes', Rule::in($profiles)],
            'template_id' => ['sometimes', 'nullable', 'string', Rule::exists('templates', 'id')],
            'default_intro_block_id' => ['sometimes', 'nullable', 'string', Rule::exists('text_blocks', 'id')],
            'default_closing_block_id' => ['sometimes', 'nullable', 'string', Rule::exists('text_blocks', 'id')],
            'payment_term_days' => ['sometimes', 'nullable', 'integer', 'min:0', 'max:365'],
            'validity_days' => ['sometimes', 'nullable', 'integer', 'min:0', 'max:365'],
            'numbering' => ['sometimes', 'array'],
            ...NumberRange::rules('numbering.'),
        ])->validate();

        return DB::transaction(function () use ($type, $data): DocumentTypeSetting {
            $setting = DocumentTypeSetting::query()->findOrFail($type->value);
            $setting->fill(Arr::except($data, ['numbering']))->save();

            if (isset($data['numbering'])) {
                NumberRange::document($type)->update($data['numbering'], 'numbering.');
            }

            return $setting;
        });
    }
}
