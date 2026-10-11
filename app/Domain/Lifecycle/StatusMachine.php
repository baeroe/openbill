<?php

namespace App\Domain\Lifecycle;

use App\Enums\DocumentStatus;
use App\Enums\DocumentType;

/** Port of prototypes/clickdummy-v2/src/domain/lifecycle.ts. */
final class StatusMachine
{
    /** @var array<string, array<string, list<string>>> */
    private const TRANSITIONS = [
        'offer' => ['draft' => ['open'], 'open' => ['accepted', 'rejected']],
        'confirmation' => ['draft' => ['open'], 'open' => ['done']],
        'invoice' => ['draft' => ['open'], 'open' => ['paid']],
        'cancellation' => ['draft' => ['closed']],
    ];

    /** @return list<DocumentStatus> */
    public static function nextStatuses(DocumentType $type, DocumentStatus $from): array
    {
        return array_map(
            fn (string $status): DocumentStatus => DocumentStatus::from($status),
            self::TRANSITIONS[$type->value][$from->value] ?? [],
        );
    }

    public static function canTransition(DocumentType $type, DocumentStatus $from, DocumentStatus $to): bool
    {
        return in_array($to, self::nextStatuses($type, $from), true);
    }

    /** Status changes a user may set; leaving draft is reserved for finalizing. */
    public static function canSetManually(DocumentType $type, DocumentStatus $from, DocumentStatus $to): bool
    {
        return $from !== DocumentStatus::Draft && self::canTransition($type, $from, $to);
    }

    public static function finalizedStatus(DocumentType $type): DocumentStatus
    {
        return $type === DocumentType::Cancellation ? DocumentStatus::Closed : DocumentStatus::Open;
    }

    public static function isLocked(DocumentStatus $status): bool
    {
        return $status !== DocumentStatus::Draft;
    }

    /** Dates as "Y-m-d"; overdue is derived, never stored. */
    public static function isOverdue(DocumentType $type, DocumentStatus $status, ?string $dueDate, string $today): bool
    {
        return $type === DocumentType::Invoice && $status === DocumentStatus::Open && $dueDate !== null && $dueDate < $today;
    }
}
