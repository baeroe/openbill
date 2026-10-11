<?php

namespace App\State\Processor;

use ApiPlatform\Metadata\DeleteOperationInterface;
use ApiPlatform\Metadata\Operation;
use ApiPlatform\Metadata\Post;
use ApiPlatform\State\ProcessorInterface;
use App\Actions\CreateDocument;
use App\Actions\DeleteDraft;
use App\Actions\UpdateDraft;
use App\ApiResource\DocumentResource;
use App\Models\Document;
use App\State\ApiContext;
use App\State\Provider\DocumentProvider;
use App\Support\DocumentInspector;

/**
 * POST = CreateDocument, PATCH = UpdateDraft (autosave), DELETE = DeleteDraft.
 *
 * @implements ProcessorInterface<mixed, DocumentResource|null>
 */
final class DocumentProcessor implements ProcessorInterface
{
    public function __construct(
        private readonly CreateDocument $create,
        private readonly UpdateDraft $update,
        private readonly DeleteDraft $delete,
        private readonly DocumentInspector $inspector,
    ) {}

    public function process(mixed $data, Operation $operation, array $uriVariables = [], array $context = []): ?DocumentResource
    {
        $actor = ApiContext::actor($context);

        if ($operation instanceof Post) {
            $document = $this->create->handle($actor, ApiContext::body($context));

            return DocumentResource::fromModel(DocumentProvider::load($document->id), $this->inspector);
        }

        $document = Document::query()->findOrFail((string) $uriVariables['id']);
        if ($operation instanceof DeleteOperationInterface) {
            $this->delete->handle($actor, $document);

            return null;
        }
        $document = $this->update->handle($actor, $document, ApiContext::body($context));

        return DocumentResource::fromModel(DocumentProvider::load($document->id), $this->inspector);
    }
}
