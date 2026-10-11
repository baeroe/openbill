<?php

namespace App\Actions;

use App\Domain\Fields\CustomValueValidator;
use App\Domain\Fields\FieldRegistry;
use App\Enums\EventAction;
use App\Enums\FieldScope;
use App\Enums\TaxTreatment;
use App\Models\Contact;
use App\Models\Customer;
use App\Models\Document;
use App\Support\Actor;
use App\Support\DomainMapper;
use App\Support\EventLog;
use App\Support\FieldErrors;
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

        return DB::transaction(function () use ($actor, $data, $customer): Customer {
            $customer ??= new Customer;
            foreach (['name', 'tax_treatment', 'locale', 'custom'] as $key) {
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
            if (($data['number'] ?? null) !== null) {
                $customer->number = $data['number'];
            } elseif (! $customer->exists) {
                $customer->number = $this->nextNumber();
            }
            $customer->save();

            if (array_key_exists('contacts', $data)) {
                $this->syncContacts($actor, $customer, $data['contacts']);
            }

            return $customer->load('contacts');
        });
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
