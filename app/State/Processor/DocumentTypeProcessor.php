<?php

namespace App\State\Processor;

use ApiPlatform\Metadata\Operation;
use ApiPlatform\State\ProcessorInterface;
use App\Actions\UpdateDocumentType;
use App\ApiResource\DocumentTypeResource;
use App\Enums\DocumentType;
use App\State\ApiContext;
use App\State\Provider\DocumentTypeProvider;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

/** @implements ProcessorInterface<mixed, DocumentTypeResource> */
final class DocumentTypeProcessor implements ProcessorInterface
{
    public function __construct(private readonly UpdateDocumentType $update) {}

    public function process(mixed $data, Operation $operation, array $uriVariables = [], array $context = []): DocumentTypeResource
    {
        $type = DocumentType::tryFrom((string) ($uriVariables['type'] ?? '')) ?? throw new NotFoundHttpException;
        $this->update->handle(ApiContext::actor($context), $type, ApiContext::body($context));

        return DocumentTypeProvider::resource($type);
    }
}
