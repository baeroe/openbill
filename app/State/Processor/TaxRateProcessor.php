<?php

namespace App\State\Processor;

use ApiPlatform\Metadata\DeleteOperationInterface;
use ApiPlatform\Metadata\Operation;
use ApiPlatform\State\ProcessorInterface;
use App\Actions\ArchiveTaxRate;
use App\Actions\SaveTaxRate;
use App\ApiResource\TaxRateResource;
use App\Models\TaxRate;
use App\State\ApiContext;

/** @implements ProcessorInterface<mixed, TaxRateResource|null> */
final class TaxRateProcessor implements ProcessorInterface
{
    public function __construct(
        private readonly SaveTaxRate $save,
        private readonly ArchiveTaxRate $archive,
    ) {}

    public function process(mixed $data, Operation $operation, array $uriVariables = [], array $context = []): ?TaxRateResource
    {
        $actor = ApiContext::actor($context);
        $rate = isset($uriVariables['id']) ? TaxRate::query()->findOrFail((string) $uriVariables['id']) : null;

        if ($operation instanceof DeleteOperationInterface && $rate !== null) {
            $this->archive->handle($actor, $rate);

            return null;
        }

        return TaxRateResource::fromModel($this->save->handle($actor, ApiContext::body($context), $rate));
    }
}
