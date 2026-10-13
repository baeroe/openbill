<?php

namespace App\State\Provider;

use ApiPlatform\Metadata\CollectionOperationInterface;
use ApiPlatform\Metadata\Operation;
use ApiPlatform\State\ProviderInterface;
use App\ApiResource\DocumentTypeResource;
use App\Enums\DocumentType;
use App\Models\DocumentTypeSetting;
use App\Support\NumberRange;
use Carbon\CarbonImmutable;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

/** @implements ProviderInterface<DocumentTypeResource> */
final class DocumentTypeProvider implements ProviderInterface
{
    /**
     * @return DocumentTypeResource|list<DocumentTypeResource>
     */
    public function provide(Operation $operation, array $uriVariables = [], array $context = []): object|array
    {
        if ($operation instanceof CollectionOperationInterface) {
            return array_map(fn (DocumentType $type): DocumentTypeResource => self::resource($type), DocumentType::cases());
        }

        $type = DocumentType::tryFrom((string) ($uriVariables['type'] ?? '')) ?? throw new NotFoundHttpException;

        return self::resource($type);
    }

    public static function resource(DocumentType $type): DocumentTypeResource
    {
        $setting = DocumentTypeSetting::query()->findOrFail($type->value);

        return new DocumentTypeResource(
            type: $type->value,
            profile: $setting->profile->value,
            template_id: $setting->template_id,
            default_intro_block_id: $setting->default_intro_block_id,
            default_closing_block_id: $setting->default_closing_block_id,
            payment_term_days: $setting->payment_term_days,
            validity_days: $setting->validity_days,
            numbering: NumberRange::document($type)->describe(CarbonImmutable::now()),
        );
    }
}
