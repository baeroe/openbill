<?php

namespace App\ApiResource;

use ApiPlatform\Metadata\ApiProperty;
use ApiPlatform\Metadata\ApiResource;
use ApiPlatform\Metadata\Get;
use ApiPlatform\Metadata\GetCollection;
use ApiPlatform\Metadata\QueryParameter;
use App\Domain\Lifecycle\StatusMachine;
use App\Http\Api\ApiMiddleware;
use App\Models\Document;
use App\Models\Position;
use App\Models\PositionGroup;
use App\State\Provider\DocumentProvider;
use App\Support\DocumentInspector;
use App\Support\IssueList;
use ArrayObject;
use Symfony\Component\Serializer\Attribute\Groups;

/**
 * Offer, order confirmation, invoice or cancellation. Groups and positions are embedded; they are
 * writable only while the document is a draft. Lists show the short form (no texts, groups, totals, issues).
 */
#[ApiResource(
    shortName: 'Document',
    normalizationContext: ['groups' => [self::ITEM], 'preserve_empty_objects' => true],
    operations: [
        new GetCollection(
            uriTemplate: '/documents',
            middleware: ApiMiddleware::READ,
            provider: DocumentProvider::class,
            normalizationContext: ['groups' => [self::LIST], 'preserve_empty_objects' => true],
            parameters: [
                'type' => new QueryParameter(description: 'offer, confirmation, invoice or cancellation'),
                'status' => new QueryParameter(description: 'draft, open, accepted, rejected, done, paid, cancelled or closed'),
                'customer_id' => new QueryParameter(description: 'customer ULID'),
                'q' => new QueryParameter(description: 'number or customer name contains'),
                'date_from' => new QueryParameter(description: 'document date from (YYYY-MM-DD)'),
                'date_to' => new QueryParameter(description: 'document date until (YYYY-MM-DD)'),
                'sort' => new QueryParameter(description: 'date, number, updated_at or gross_total; prefix "-" for descending (default -date)'),
            ],
        ),
        new Get(uriTemplate: '/documents/{id}', middleware: ApiMiddleware::READ, provider: DocumentProvider::class),
    ],
)]
final class DocumentResource
{
    public const LIST = 'document:list';

    public const ITEM = 'document:item';

    /**
     * @param  ArrayObject<string, mixed>  $custom
     * @param  list<array<string, mixed>>  $groups
     * @param  array<string, mixed>|null  $totals
     * @param  list<array{path: string, message: string, code: string}>  $issues
     * @param  list<string>  $dropped_fields
     */
    public function __construct(
        #[ApiProperty(identifier: true, writable: false)]
        #[Groups([self::LIST, self::ITEM])]
        public string $id,
        #[Groups([self::LIST, self::ITEM])]
        public string $type,
        #[ApiProperty(writable: false)]
        #[Groups([self::LIST, self::ITEM])]
        public string $status,
        #[ApiProperty(writable: false)]
        #[Groups([self::LIST, self::ITEM])]
        public ?string $number,
        #[Groups([self::LIST, self::ITEM])]
        public string $date,
        #[Groups([self::LIST, self::ITEM])]
        public ?string $customer_id,
        #[ApiProperty(writable: false)]
        #[Groups([self::LIST, self::ITEM])]
        public ?string $customer_name,
        #[Groups([self::LIST, self::ITEM])]
        public ?string $contact_id,
        #[Groups([self::ITEM])]
        public ?string $service_date,
        #[Groups([self::ITEM])]
        public ?string $service_date_end,
        #[Groups([self::LIST, self::ITEM])]
        public ?string $due_date,
        #[Groups([self::LIST, self::ITEM])]
        public ?string $valid_until,
        #[Groups([self::ITEM])]
        public string $intro,
        #[Groups([self::ITEM])]
        public string $closing,
        #[Groups([self::ITEM])]
        public ?string $template_id,
        #[Groups([self::LIST, self::ITEM])]
        public string $locale,
        #[Groups([self::ITEM])]
        public ArrayObject $custom,
        #[ApiProperty(writable: false)]
        #[Groups([self::LIST, self::ITEM])]
        public ?string $source_id,
        #[ApiProperty(writable: false)]
        #[Groups([self::LIST, self::ITEM])]
        public ?string $cancelled_by_id,
        #[ApiProperty(writable: false)]
        #[Groups([self::LIST, self::ITEM])]
        public bool $is_locked,
        #[ApiProperty(writable: false)]
        #[Groups([self::LIST, self::ITEM])]
        public bool $is_overdue,
        #[ApiProperty(writable: false)]
        #[Groups([self::LIST, self::ITEM])]
        public ?string $finalized_at,
        #[ApiProperty(writable: false)]
        #[Groups([self::LIST, self::ITEM])]
        public ?string $paid_at,
        #[ApiProperty(writable: false)]
        #[Groups([self::LIST, self::ITEM])]
        public string $net_total,
        #[ApiProperty(writable: false)]
        #[Groups([self::LIST, self::ITEM])]
        public string $tax_total,
        #[ApiProperty(writable: false)]
        #[Groups([self::LIST, self::ITEM])]
        public string $gross_total,
        #[Groups([self::ITEM])]
        public array $groups,
        #[ApiProperty(writable: false)]
        #[Groups([self::ITEM])]
        public ?array $totals,
        #[ApiProperty(writable: false)]
        #[Groups([self::ITEM])]
        public array $issues,
        #[ApiProperty(writable: false, description: 'custom fields the target type does not use (only in the answer of convert/cancel)')]
        #[Groups([self::ITEM])]
        public array $dropped_fields,
        #[ApiProperty(writable: false)]
        #[Groups([self::LIST, self::ITEM])]
        public ?string $created_at,
        #[ApiProperty(writable: false)]
        #[Groups([self::LIST, self::ITEM])]
        public ?string $updated_at,
    ) {}

    /**
     * @param  DocumentInspector|null  $inspector  given: item form with groups, totals and (drafts) issues
     * @param  list<string>  $droppedFields
     */
    public static function fromModel(Document $document, ?DocumentInspector $inspector = null, array $droppedFields = []): self
    {
        $totals = $inspector?->totals($document)->toArray();

        return new self(
            id: $document->id,
            type: $document->type->value,
            status: $document->status->value,
            number: $document->number,
            date: $document->date->toDateString(),
            customer_id: $document->customer_id,
            customer_name: $document->customer?->name,
            contact_id: $document->contact_id,
            service_date: $document->service_date?->toDateString(),
            service_date_end: $document->service_date_end?->toDateString(),
            due_date: $document->due_date?->toDateString(),
            valid_until: $document->valid_until?->toDateString(),
            intro: (string) $document->intro,
            closing: (string) $document->closing,
            template_id: $document->template_id,
            locale: $document->locale,
            custom: new ArrayObject($document->custom ?? []),
            source_id: $document->source_id,
            cancelled_by_id: $document->cancelled_by_id,
            is_locked: $document->isFinalized(),
            is_overdue: StatusMachine::isOverdue($document->type, $document->status, $document->due_date?->toDateString(), now()->toDateString()),
            finalized_at: $document->finalized_at?->toAtomString(),
            paid_at: $document->paid_at?->toAtomString(),
            net_total: (string) $document->net_total,
            tax_total: (string) $document->tax_total,
            gross_total: (string) $document->gross_total,
            groups: $inspector === null ? [] : self::groups($document),
            // keyed maps stay JSON objects even when empty
            totals: $totals === null ? null : [...$totals, 'lines' => new ArrayObject($totals['lines']), 'groups' => new ArrayObject($totals['groups'])],
            issues: $inspector === null || $document->isFinalized() ? [] : IssueList::toArray($inspector->issues($document)),
            dropped_fields: $droppedFields,
            created_at: $document->created_at?->toAtomString(),
            updated_at: $document->updated_at?->toAtomString(),
        );
    }

    /**
     * Same shape UpdateDraft takes as "groups".
     *
     * @return list<array<string, mixed>>
     */
    private static function groups(Document $document): array
    {
        return $document->groups->map(fn (PositionGroup $group): array => [
            'id' => $group->id,
            'title' => $group->title,
            'positions' => $group->positions->map(fn (Position $position): array => [
                'id' => $position->id,
                'kind' => $position->kind->value,
                'title' => (string) $position->title,
                'description' => (string) $position->description,
                'quantity' => (string) $position->quantity,
                'unit_id' => $position->unit_id,
                'unit_price' => (string) $position->unit_price,
                'tax_rate_id' => $position->tax_rate_id,
                'custom' => new ArrayObject($position->custom ?? []),
            ])->values()->all(),
        ])->values()->all();
    }
}
