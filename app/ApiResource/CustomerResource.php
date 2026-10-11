<?php

namespace App\ApiResource;

use ApiPlatform\Metadata\ApiProperty;
use ApiPlatform\Metadata\ApiResource;
use ApiPlatform\Metadata\Delete;
use ApiPlatform\Metadata\Get;
use ApiPlatform\Metadata\GetCollection;
use ApiPlatform\Metadata\Patch;
use ApiPlatform\Metadata\Post;
use ApiPlatform\Metadata\QueryParameter;
use App\Http\Api\ApiMiddleware;
use App\Models\Contact;
use App\Models\Customer;
use App\State\Processor\CustomerProcessor;
use App\State\Provider\CustomerProvider;
use ArrayObject;

/**
 * Customer with its contacts. "contacts" in a write is the complete list (missing ones are removed,
 * ids keep existing ones); exactly one is the default.
 */
#[ApiResource(
    shortName: 'Customer',
    normalizationContext: Normalization::CONTEXT,
    operations: [
        new GetCollection(
            uriTemplate: '/customers',
            middleware: ApiMiddleware::READ,
            provider: CustomerProvider::class,
            parameters: ['q' => new QueryParameter(description: 'name, number or email contains')],
        ),
        new Get(uriTemplate: '/customers/{id}', middleware: ApiMiddleware::READ, provider: CustomerProvider::class),
        new Post(uriTemplate: '/customers', middleware: ApiMiddleware::WRITE, read: false, deserialize: false, processor: CustomerProcessor::class),
        new Patch(uriTemplate: '/customers/{id}', middleware: ApiMiddleware::WRITE, read: false, deserialize: false, processor: CustomerProcessor::class),
        new Delete(uriTemplate: '/customers/{id}', middleware: ApiMiddleware::WRITE, read: false, processor: CustomerProcessor::class),
    ],
)]
final class CustomerResource
{
    /**
     * @param  ArrayObject<string, mixed>  $custom
     * @param  list<array<string, mixed>>  $contacts
     */
    public function __construct(
        #[ApiProperty(identifier: true, writable: false)]
        public string $id,
        public string $number,
        public string $name,
        public string $street,
        public string $zip,
        public string $city,
        public string $country,
        public string $email,
        public string $vat_id,
        public string $tax_treatment,
        public ?string $locale,
        public ArrayObject $custom,
        public array $contacts,
        #[ApiProperty(writable: false)]
        public ?string $created_at,
        #[ApiProperty(writable: false)]
        public ?string $updated_at,
    ) {}

    public static function fromModel(Customer $customer): self
    {
        $customer->loadMissing('contacts');

        return new self(
            id: $customer->id,
            number: $customer->number,
            name: $customer->name,
            street: (string) $customer->street,
            zip: (string) $customer->zip,
            city: (string) $customer->city,
            country: (string) $customer->country,
            email: (string) $customer->email,
            vat_id: (string) $customer->vat_id,
            tax_treatment: $customer->tax_treatment->value,
            locale: $customer->locale,
            custom: new ArrayObject($customer->custom ?? []),
            contacts: $customer->contacts->map(fn (Contact $contact): array => [
                'id' => $contact->id,
                'salutation' => (string) $contact->salutation,
                'first_name' => (string) $contact->first_name,
                'last_name' => (string) $contact->last_name,
                'position' => (string) $contact->position,
                'email' => (string) $contact->email,
                'phone' => (string) $contact->phone,
                'is_default' => $contact->is_default,
                'custom' => new ArrayObject($contact->custom ?? []),
            ])->values()->all(),
            created_at: $customer->created_at?->toAtomString(),
            updated_at: $customer->updated_at?->toAtomString(),
        );
    }
}
