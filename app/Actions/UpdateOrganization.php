<?php

namespace App\Actions;

use App\Domain\Fields\CustomValueValidator;
use App\Domain\Fields\FieldRegistry;
use App\Enums\FieldScope;
use App\Enums\TaxationMode;
use App\Models\Organization;
use App\Support\Actor;
use App\Support\DomainMapper;
use App\Support\FieldErrors;
use App\Support\TrimmedInput;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

final class UpdateOrganization
{
    private const STRINGS = ['name', 'street', 'zip', 'city', 'country', 'vat_id', 'tax_number', 'registration_id', 'iban', 'bic', 'bank_name', 'email', 'phone', 'website'];

    /**
     * @param  array<string, mixed>  $input
     *
     * @throws ValidationException
     */
    public function handle(Actor $actor, array $input): Organization
    {
        $input = TrimmedInput::strings($input, self::STRINGS);
        $data = Validator::make($input, [
            'name' => ['sometimes', 'nullable', 'string', 'max:255'],
            'street' => ['sometimes', 'nullable', 'string', 'max:255'],
            'zip' => ['sometimes', 'nullable', 'string', 'max:32'],
            'city' => ['sometimes', 'nullable', 'string', 'max:255'],
            'country' => ['sometimes', 'nullable', 'string', 'size:2'],
            'vat_id' => ['sometimes', 'nullable', 'string', 'max:32'],
            'tax_number' => ['sometimes', 'nullable', 'string', 'max:32'],
            'registration_id' => ['sometimes', 'nullable', 'string', 'max:64'],
            'iban' => ['sometimes', 'nullable', 'string', 'max:42'],
            'bic' => ['sometimes', 'nullable', 'string', 'max:11'],
            'bank_name' => ['sometimes', 'nullable', 'string', 'max:255'],
            'email' => ['sometimes', 'nullable', 'email', 'max:255'],
            'phone' => ['sometimes', 'nullable', 'string', 'max:64'],
            'website' => ['sometimes', 'nullable', 'string', 'max:255'],
            'taxation_mode' => ['sometimes', Rule::enum(TaxationMode::class)],
            'locale' => ['sometimes', Rule::in(['en', 'de'])],
            'custom' => ['sometimes', 'array'],
        ])->validate();

        if (array_key_exists('custom', $data)) {
            $fields = FieldRegistry::forScope(DomainMapper::currentFieldDefinitions(), FieldScope::Org);
            $result = CustomValueValidator::validate($fields, $data['custom'], 'custom.', true);
            FieldErrors::throwIfAny($result->errors);
            $data['custom'] = $result->values;
        }

        $org = Organization::current();
        foreach (self::STRINGS as $key) {
            if (array_key_exists($key, $data)) {
                $value = (string) ($data[$key] ?? '');
                $org->{$key} = $key === 'country' ? strtoupper($value) : $value;
            }
        }
        foreach (['taxation_mode', 'locale', 'custom'] as $key) {
            if (array_key_exists($key, $data)) {
                $org->{$key} = $data[$key];
            }
        }
        $org->save();

        return $org;
    }
}
