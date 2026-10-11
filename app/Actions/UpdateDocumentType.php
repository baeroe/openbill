<?php

namespace App\Actions;

use App\Domain\Numbering\NumberFormatter;
use App\Enums\ComplianceProfile;
use App\Enums\DocumentType;
use App\Models\DocumentTypeSetting;
use App\Models\NumberSequence;
use App\Support\Actor;
use App\Support\Text;
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
            'numbering.pattern' => ['sometimes', 'string', 'max:64', 'regex:/\{0+\}/'],
            'numbering.reset_yearly' => ['sometimes', 'boolean'],
            'numbering.next_value' => ['sometimes', 'integer', 'min:1', 'max:99999999'],
        ])->validate();

        return DB::transaction(function () use ($type, $data): DocumentTypeSetting {
            $setting = DocumentTypeSetting::query()->findOrFail($type->value);
            $setting->fill(Arr::except($data, ['numbering']))->save();

            if (isset($data['numbering'])) {
                $this->updateNumbering($type, $data['numbering']);
            }

            return $setting;
        });
    }

    /**
     * @param  array<string, mixed>  $numbering
     *
     * @throws ValidationException
     */
    private function updateNumbering(DocumentType $type, array $numbering): void
    {
        $config = NumberSequence::query()->where('doc_type', $type->value)->whereNull('year')->lockForUpdate()->firstOrFail();
        $pattern = $numbering['pattern'] ?? $config->pattern;
        $resetYearly = array_key_exists('reset_yearly', $numbering) ? (bool) $numbering['reset_yearly'] : $config->reset_yearly;

        // a yearly reset without the year in the pattern would hand out the same number every year
        if ($resetYearly && ! NumberFormatter::hasYear($pattern)) {
            throw ValidationException::withMessages(['numbering.pattern' => [Text::t('errors.number_pattern_year')]]);
        }

        $config->forceFill(['pattern' => $pattern, 'reset_yearly' => $resetYearly]);
        if (isset($numbering['next_value'])) {
            if ($resetYearly) {
                NumberSequence::query()->updateOrCreate(
                    ['doc_type' => $type->value, 'year' => (int) now()->format('Y')],
                    ['pattern' => $pattern, 'reset_yearly' => true, 'next_value' => (int) $numbering['next_value']],
                );
            } else {
                $config->next_value = (int) $numbering['next_value'];
            }
        }
        $config->save();
    }
}
