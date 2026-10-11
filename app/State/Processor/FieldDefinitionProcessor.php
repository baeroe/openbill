<?php

namespace App\State\Processor;

use ApiPlatform\Metadata\DeleteOperationInterface;
use ApiPlatform\Metadata\Operation;
use ApiPlatform\State\ProcessorInterface;
use App\Actions\DeleteFieldDefinition;
use App\Actions\SaveFieldDefinition;
use App\ApiResource\FieldDefinitionResource;
use App\Models\FieldDefinition;
use App\State\ApiContext;

/** @implements ProcessorInterface<mixed, FieldDefinitionResource|null> */
final class FieldDefinitionProcessor implements ProcessorInterface
{
    public function __construct(
        private readonly SaveFieldDefinition $save,
        private readonly DeleteFieldDefinition $delete,
    ) {}

    public function process(mixed $data, Operation $operation, array $uriVariables = [], array $context = []): ?FieldDefinitionResource
    {
        $actor = ApiContext::actor($context);
        $field = isset($uriVariables['id']) ? FieldDefinition::query()->findOrFail((string) $uriVariables['id']) : null;

        if ($operation instanceof DeleteOperationInterface && $field !== null) {
            $this->delete->handle($actor, $field);

            return null;
        }

        return FieldDefinitionResource::fromModel($this->save->handle($actor, ApiContext::body($context), $field));
    }
}
