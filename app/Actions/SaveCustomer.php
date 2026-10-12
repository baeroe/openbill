<?php

namespace App\Actions;

use App\Domain\Fields\CustomValueValidator;
use App\Domain\Fields\FieldRegistry;
use App\Enums\CustomerKind;
use App\Enums\EventAction;
use App\Enums\FieldScope;
use App\Enums\SupplyType;
use App\Enums\TaxTreatment;
use App\Models\Contact;
use App\Models\Customer;
use App\Models\Document;
use App\Support\Actor;
use App\Support\DomainMapper;
use App\Support\EventLog;
use App\Support\FieldErrors;
use App\Support\Text;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

/**
 * Creates or updates a customer. `contacts`, when given, is the complete list: missing contacts are
 * soft-deleted (drafts lose them, finalized documents keep theirs). Exactly one contact is the default.
 * Required custom fields are enforced here (documents enforce theirs when finalizing).
 */
final class SaveCustomer
{
    private const STRINGS = ['street', 'zip', 'city', 'country', 'email', 'vat_id'];

    private const CONTACT_STRINGS = ['salutation', 'first_name', 'last_name', 'position', 'email', 'phone'];

    /**
     * @param  array<string, mixed>  $input
     *
     * @throws ValidationException
     */
    public function handle(Actor $actor, array $input, ?Customer $customer = null): Customer
    {
        $input = self::trimmed($input);
        $data = Validator::make($input, [
            'number' => ['sometimes', 'nullable', 'string', 'max:32', Rule::unique('customers', 'number')->ignore($customer?->id)],
            'name' => [$customer === null ? 'required' : 'sometimes', 'string', 'max:255'],
            'street' => ['sometimes', 'nullable', 'string', 'max:255'],
            'zip' => ['sometimes', 'nullable', 'string', 'max:32'],
            'city' => ['sometimes', 'nullable', 'string', 'max:255'],
            'country' => ['sometimes', 'nullable', 'string', 'size:2'],
            'email' => ['sometimes', 'nullable', 'email', 'max:255'],
            'vat_id' => ['sometimes', 'nullable', 'string', 'max:32'],
            'tax_treatment' => ['sometimes', Rule::enum(TaxTreatment::class)],
            'supply_type' => ['sometimes', Rule::enum(SupplyType::class)],
            'customer_kind' => ['sometimes', Rule::enum(CustomerKind::class)],
            'locale' => ['sometimes', 'nullable', Rule::in(['en', 'de'])],
            'custom' => ['sometimes', 'array'],
            'contacts' => ['sometimes', 'array', 'list', 'max:100'],
            'contacts.*' => ['array'],
            'contacts.*.id' => ['sometimes', 'nullable', 'string'],
            'contacts.*.salutation' => ['sometimes', 'nullable', 'string', 'max:64'],
            'contacts.*.first_name' => ['sometimes', 'nullable', 'string', 'max:255'],
            'contacts.*.last_name' => ['sometimes', 'nullable', 'string', 'max:255'],
            'contacts.*.position' => ['sometimes', 'nullable', 'string', 'max:255'],
            'contacts.*.email' => ['sometimes', 'nullable', 'email', 'max:255'],
            'contacts.*.phone' => ['sometimes', 'nullable', 'string', 'max:64'],
            'contacts.*.is_default' => ['sometimes', 'boolean'],
            'contacts.*.custom' => ['sometimes', 'array'],
        ])->validate();

        // reverse charge (§ 13b UStG) shifts the VAT to a business; a private person always pays it. Checked only
        // when the combination is new: customers stored before this rule stay editable (the form always sends both
        // keys and shows a hint to correct them) as long as kind and treatment stay as they are
        // a model without loaded defaults (e.g. not refreshed after create) has null here: the columns' defaults apply
        $storedKind = $customer?->getAttribute('customer_kind');
        $storedKind = $storedKind instanceof CustomerKind ? $storedKind->value : CustomerKind::Business->value;
        $storedTreatment = $customer?->getAttribute('tax_treatment');
        $storedTreatment = $storedTreatment instanceof TaxTreatment ? $storedTreatment->value : TaxTreatment::Domestic->value;
        $kind = $data['customer_kind'] ?? $storedKind;
        $treatment = $data['tax_treatment'] ?? $storedTreatment;
        $changed = $customer === null || $kind !== $storedKind || $treatment !== $storedTreatment;
        if ($changed && $kind === CustomerKind::Consumer->value && $treatment === TaxTreatment::EuReverseCharge->value) {
            throw ValidationException::withMessages(['customer_kind' => Text::t('customer.consumer_reverse_charge')]);
        }

        $definitions = DomainMapper::currentFieldDefinitions();
        $customerFields = FieldRegistry::forScope($definitions, FieldScope::Customer);
        $contactFields = FieldRegistry::forScope($definitions, FieldScope::Contact);
        $errors = [];

        if ($customer === null || array_key_exists('custom', $data)) {
            $values = $customer === null ? [...FieldRegistry::defaults($customerFields), ...($data['custom'] ?? [])] : $data['custom'];
            $result = CustomValueValidator::validate($customerFields, $values, 'custom.', true);
            $errors = $result->errors;
            $data['custom'] = $result->values;
        }
        foreach ($data['contacts'] ?? [] as $i => $contact) {
            $result = CustomValueValidator::validate($contactFields, $contact['custom'] ?? [], "contacts.{$i}.custom.", true);
            $errors = [...$errors, ...$result->errors];
            $data['contacts'][$i]['custom'] = $result->values;
        }
        FieldErrors::throwIfAny($errors);

        // retried on deadlocks with UpdateDraft (see there)
        return DB::transaction(function () use ($actor, $data, $customer): Customer {
            $customer ??= new Customer;
            foreach (['name', 'tax_treatment', 'supply_type', 'customer_kind', 'locale', 'custom'] as $key) {
                if (array_key_exists($key, $data)) {
                    $customer->{$key} = $data[$key];
                }
            }
            foreach (self::STRINGS as $key) {
                if (array_key_exists($key, $data)) {
                    $value = (string) ($data[$key] ?? '');
                    $customer->{$key} = $key === 'country' ? strtoupper($value) : $value;
                }
            }
            // an empty number means "next number" for a new customer and "keep it" for an existing one
            if (($data['number'] ?? '') !== '') {
                $customer->number = $data['number'];
            } elseif (! $customer->exists) {
                $customer->number = $this->nextNumber();
            }
            $customer->save();

            if (array_key_exists('contacts', $data)) {
                $this->syncContacts($actor, $customer, $data['contacts']);
            }

            // refresh: columns with database defaults (tax_treatment) are not on a new model otherwise
            return $customer->refresh()->load('contacts');
        }, 3);
    }

    /** Highest numeric customer number + 1, with its prefix ("K-1004" → "K-1005"); first customer "C-1001". */
    private function nextNumber(): string
    {
        $max = 1000;
        $prefix = 'C-';
        foreach (Customer::withTrashed()->pluck('number') as $number) {
            if (preg_match('/^(\D*)(\d+)$/', (string) $number, $m) === 1 && (int) $m[2] >= $max) {
                $max = (int) $m[2];
                $prefix = $m[1];
            }
        }

        return $prefix.($max + 1);
    }

    /**
     * Master data is stored without surrounding blanks. Laravel's TrimStrings middleware never sees the
     * JSON bodies of the API (API Platform reads the raw body), so the action trims itself.
     *
     * @param  array<string, mixed>  $input
     * @return array<string, mixed>
     */
    private static function trimmed(array $input): array
    {
        foreach (['number', 'name', ...self::STRINGS] as $key) {
            if (isset($input[$key]) && is_string($input[$key])) {
                $input[$key] = trim($input[$key]);
            }
        }
        if (isset($input['contacts']) && is_array($input['contacts'])) {
            foreach ($input['contacts'] as $i => $contact) {
                if (! is_array($contact)) {
                    continue;
                }
                foreach (self::CONTACT_STRINGS as $key) {
                    if (isset($contact[$key]) && is_string($contact[$key])) {
                        $input['contacts'][$i][$key] = trim($contact[$key]);
                    }
                }
            }
        }

        return $input;
    }

    /**
     * @param  list<array<string, mixed>>  $rows
     */
    private function syncContacts(Actor $actor, Customer $customer, array $rows): void
    {
        $existing = $customer->contacts()->pluck('id')->all();
        $defaultIndex = 0;
        foreach ($rows as $i => $row) {
            if (! empty($row['is_default'])) {
                $defaultIndex = $i;
                break;
            }
        }

        $kept = [];
        foreach ($rows as $i => $row) {
            $id = is_string($row['id'] ?? null) && in_array($row['id'], $existing, true) ? $row['id'] : null;
            $contact = $id === null ? new Contact : Contact::query()->findOrFail($id);
            $values = ['customer_id' => $customer->id, 'is_default' => $i === $defaultIndex, 'custom' => $row['custom'] ?? []];
            foreach (self::CONTACT_STRINGS as $key) {
                $values[$key] = (string) ($row[$key] ?? '');
            }
            $contact->forceFill($values)->save();
            $kept[] = $contact->id;
        }

        $removed = array_values(array_diff($existing, $kept));
        if ($removed !== []) {
            // drafts only; finalized documents keep their contact (and their snapshot). One event per draft.
            $drafts = Document::query()->whereIn('contact_id', $removed)->whereNull('finalized_at')->lockForUpdate()->get();
            foreach ($drafts as $draft) {
                $draft->forceFill(['contact_id' => null])->save();
                EventLog::record($draft, $actor, EventAction::Updated, ['fields' => ['contact_id']]);
            }
            Contact::query()->whereIn('id', $removed)->delete();
        }
    }
}
