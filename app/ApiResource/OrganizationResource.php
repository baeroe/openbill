<?php

namespace App\ApiResource;

use ApiPlatform\Metadata\ApiProperty;
use ApiPlatform\Metadata\ApiResource;
use ApiPlatform\Metadata\Get;
use ApiPlatform\Metadata\Patch;
use App\Http\Api\ApiMiddleware;
use App\Models\Organization;
use App\State\Processor\OrganizationProcessor;
use App\State\Provider\OrganizationProvider;
use ArrayObject;

/** The one organization of this instance (sender of every document). The logo upload comes in phase 7. */
#[ApiResource(
    shortName: 'Organization',
    normalizationContext: ['preserve_empty_objects' => true, 'skip_null_values' => false],
    operations: [
        new Get(uriTemplate: '/organization', uriVariables: [], middleware: ApiMiddleware::READ, provider: OrganizationProvider::class),
        new Patch(uriTemplate: '/organization', uriVariables: [], middleware: ApiMiddleware::WRITE, read: false, deserialize: false, processor: OrganizationProcessor::class),
    ],
)]
final class OrganizationResource
{
    /**
     * @param  ArrayObject<string, mixed>  $custom
     */
    public function __construct(
        #[ApiProperty(identifier: true, writable: false)]
        public string $id,
        public string $name,
        public string $street,
        public string $zip,
        public string $city,
        public string $country,
        #[ApiProperty(writable: false)]
        public bool $has_logo,
        public string $vat_id,
        public string $tax_number,
        public string $registration_id,
        public string $iban,
        public string $bic,
        public string $bank_name,
        public string $email,
        public string $phone,
        public string $website,
        public string $taxation_mode,
        public string $locale,
        public ArrayObject $custom,
        #[ApiProperty(writable: false)]
        public ?string $updated_at,
    ) {}

    public static function fromModel(Organization $org): self
    {
        return new self(
            id: $org->id,
            name: (string) $org->name,
            street: (string) $org->street,
            zip: (string) $org->zip,
            city: (string) $org->city,
            country: (string) $org->country,
            has_logo: $org->logo_path !== null && $org->logo_path !== '',
            vat_id: (string) $org->vat_id,
            tax_number: (string) $org->tax_number,
            registration_id: (string) $org->registration_id,
            iban: (string) $org->iban,
            bic: (string) $org->bic,
            bank_name: (string) $org->bank_name,
            email: (string) $org->email,
            phone: (string) $org->phone,
            website: (string) $org->website,
            taxation_mode: $org->taxation_mode->value,
            locale: (string) $org->locale,
            custom: new ArrayObject($org->custom ?? []),
            updated_at: $org->updated_at?->toAtomString(),
        );
    }
}
