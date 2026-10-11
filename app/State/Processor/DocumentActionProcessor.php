<?php

namespace App\State\Processor;

use ApiPlatform\Metadata\Operation;
use ApiPlatform\State\ProcessorInterface;
use App\Actions\CancelInvoice;
use App\Actions\ConvertDocument;
use App\Actions\DuplicateDocument;
use App\Actions\FinalizeDocument;
use App\Actions\SetDocumentStatus;
use App\ApiResource\DocumentResource;
use App\Enums\DocumentStatus;
use App\Enums\DocumentType;
use App\Models\Document;
use App\State\ApiContext;
use App\State\Provider\DocumentProvider;
use App\Support\ConversionResult;
use App\Support\DocumentInspector;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;
use LogicException;

/**
 * POST /api/documents/{id}/finalize|status|convert|cancel|duplicate – one action each.
 *
 * @implements ProcessorInterface<mixed, DocumentResource>
 */
final class DocumentActionProcessor implements ProcessorInterface
{
    public function __construct(
        private readonly FinalizeDocument $finalize,
        private readonly SetDocumentStatus $status,
        private readonly ConvertDocument $convert,
        private readonly CancelInvoice $cancel,
        private readonly DuplicateDocument $duplicate,
        private readonly DocumentInspector $inspector,
    ) {}

    public function process(mixed $data, Operation $operation, array $uriVariables = [], array $context = []): DocumentResource
    {
        $actor = ApiContext::actor($context);
        $document = Document::query()->findOrFail((string) $uriVariables['id']);

        $result = match ($operation->getName()) {
            'document_finalize' => $this->finalize->handle($actor, $document),
            'document_status' => $this->status->handle($actor, $document, DocumentStatus::from(self::field($context, 'status', DocumentStatus::class))),
            'document_convert' => $this->convert->handle($actor, $document, DocumentType::from(self::field($context, 'type', DocumentType::class))),
            'document_cancel' => $this->cancel->handle($actor, $document),
            'document_duplicate' => $this->duplicate->handle($actor, $document),
            default => throw new LogicException("Unknown document operation {$operation->getName()}."),
        };

        $dropped = $result instanceof ConversionResult ? $result->droppedFields : [];
        $id = $result instanceof ConversionResult ? $result->document->id : $result->id;

        return DocumentResource::fromModel(DocumentProvider::load($id), $this->inspector, $dropped);
    }

    /**
     * One required enum value from the JSON body (422 with its path otherwise).
     *
     * @param  array<string, mixed>  $context
     * @param  class-string<\BackedEnum>  $enum
     */
    private static function field(array $context, string $key, string $enum): string
    {
        $data = Validator::make(ApiContext::body($context), [$key => ['required', Rule::enum($enum)]])->validate();

        return (string) $data[$key];
    }
}
