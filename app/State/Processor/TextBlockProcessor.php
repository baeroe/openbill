<?php

namespace App\State\Processor;

use ApiPlatform\Metadata\DeleteOperationInterface;
use ApiPlatform\Metadata\Operation;
use ApiPlatform\State\ProcessorInterface;
use App\Actions\DeleteTextBlock;
use App\Actions\SaveTextBlock;
use App\ApiResource\TextBlockResource;
use App\Models\TextBlock;
use App\State\ApiContext;

/** @implements ProcessorInterface<mixed, TextBlockResource|null> */
final class TextBlockProcessor implements ProcessorInterface
{
    public function __construct(
        private readonly SaveTextBlock $save,
        private readonly DeleteTextBlock $delete,
    ) {}

    public function process(mixed $data, Operation $operation, array $uriVariables = [], array $context = []): ?TextBlockResource
    {
        $actor = ApiContext::actor($context);
        $block = isset($uriVariables['id']) ? TextBlock::query()->findOrFail((string) $uriVariables['id']) : null;

        if ($operation instanceof DeleteOperationInterface && $block !== null) {
            $this->delete->handle($actor, $block);

            return null;
        }

        return TextBlockResource::fromModel($this->save->handle($actor, ApiContext::body($context), $block));
    }
}
