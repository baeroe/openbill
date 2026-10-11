<?php

namespace App\State\Processor;

use ApiPlatform\Metadata\DeleteOperationInterface;
use ApiPlatform\Metadata\Operation;
use ApiPlatform\State\ProcessorInterface;
use App\Actions\ArchiveUnit;
use App\Actions\SaveUnit;
use App\ApiResource\UnitResource;
use App\Models\Unit;
use App\State\ApiContext;

/** @implements ProcessorInterface<mixed, UnitResource|null> */
final class UnitProcessor implements ProcessorInterface
{
    public function __construct(
        private readonly SaveUnit $save,
        private readonly ArchiveUnit $archive,
    ) {}

    public function process(mixed $data, Operation $operation, array $uriVariables = [], array $context = []): ?UnitResource
    {
        $actor = ApiContext::actor($context);
        $unit = isset($uriVariables['id']) ? Unit::query()->findOrFail((string) $uriVariables['id']) : null;

        if ($operation instanceof DeleteOperationInterface && $unit !== null) {
            $this->archive->handle($actor, $unit);

            return null;
        }

        return UnitResource::fromModel($this->save->handle($actor, ApiContext::body($context), $unit));
    }
}
