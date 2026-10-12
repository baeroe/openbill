<?php

namespace App\Actions;

use App\Domain\Conversion\DocumentConverter;
use App\Domain\Lifecycle\StatusMachine;
use App\Enums\DocumentStatus;
use App\Enums\DocumentType;
use App\Enums\TaxationMode;
use App\Models\Document;
use App\Models\DocumentTypeSetting;
use App\Models\Organization;
use App\Models\Template;
use App\Support\Actor;
use App\Support\DocumentChain;
use App\Support\DocumentInspector;

/**
 * Page context of the document editor (Inertia prop "context" of documents/show): everything the browser
 * must not decide itself – compliance profile, number preview, allowed status changes and conversions,
 * chain, small business, templates per document type. Reads only.
 */
final class DescribeDocumentPage
{
    public function __construct(
        private readonly AllocateDocumentNumber $numbers,
        private readonly DocumentInspector $inspector,
    ) {}

    /**
     * @return array{
     *     profile: string,
     *     next_number: string|null,
     *     small_business: bool,
     *     chain: list<array{id: string, type: string, status: string, number: string|null}>,
     *     templates: list<array{id: string, name: string, document_types: list<string>}>,
     *     allowed: array{finalize: bool, delete: bool, duplicate: bool, statuses: list<string>, conversions: list<string>, cancel: bool}
     * }
     */
    public function handle(Actor $actor, Document $document): array
    {
        $setting = DocumentTypeSetting::query()->findOrFail($document->type->value);
        $draft = ! $document->isFinalized();

        return [
            'profile' => $setting->profile->value,
            'next_number' => $draft ? $this->numbers->preview($document->type, $document->date->toDateString()) : null,
            'small_business' => $this->smallBusiness($document, $draft),
            'chain' => DocumentChain::for($document),
            'templates' => Template::query()->orderBy('name')->get(['id', 'name', 'manifest'])
                ->map(fn (Template $template): array => [
                    'id' => $template->id,
                    'name' => $template->name,
                    'document_types' => array_values(array_filter((array) ($template->manifest['documentTypes'] ?? []), 'is_string')),
                ])->values()->all(),
            'allowed' => self::allowed($document, $draft),
        ];
    }

    private function smallBusiness(Document $document, bool $draft): bool
    {
        // a cancellation draft follows its invoice's snapshot (SnapshotBuilder::withInvoiceTax)
        if ($draft && $document->type !== DocumentType::Cancellation) {
            return Organization::current()->taxation_mode === TaxationMode::SmallBusiness;
        }
        $org = $this->inspector->sources($document)['org'] ?? [];

        return is_array($org) && ($org['taxation_mode'] ?? null) === TaxationMode::SmallBusiness->value;
    }

    /**
     * @return array{finalize: bool, delete: bool, duplicate: bool, statuses: list<string>, conversions: list<string>, cancel: bool}
     */
    private static function allowed(Document $document, bool $draft): array
    {
        $type = $document->type;
        $status = $document->status;
        $cancelled = $document->cancelled_by_id !== null;

        $statuses = array_values(array_map(
            fn (DocumentStatus $to): string => $to->value,
            array_filter(StatusMachine::nextStatuses($type, $status), fn (DocumentStatus $to): bool => StatusMachine::canSetManually($type, $status, $to)),
        ));
        $conversions = array_values(array_filter(
            DocumentConverter::CONVERSIONS[$type->value],
            fn (string $target): bool => $target !== DocumentType::Cancellation->value
                && DocumentConverter::canConvert($type, $status, $cancelled, DocumentType::from($target)),
        ));

        return [
            'finalize' => $draft,
            'delete' => $draft,
            'duplicate' => $type !== DocumentType::Cancellation,
            'statuses' => $statuses,
            'conversions' => $conversions,
            'cancel' => DocumentConverter::canConvert($type, $status, $cancelled, DocumentType::Cancellation),
        ];
    }
}
