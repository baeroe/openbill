<?php

namespace App\Domain\Conversion;

use App\Domain\Fields\FieldDefinitionData;
use App\Domain\Fields\FieldRegistry;
use App\Domain\Totals\GroupInput;
use App\Domain\Totals\PositionInput;
use App\Enums\DocumentStatus;
use App\Enums\DocumentType;
use App\Enums\FieldScope;
use App\Enums\PositionKind;
use DateTimeImmutable;
use DomainException;

/** Port of prototypes/clickdummy-v2/src/domain/convert.ts. */
final class DocumentConverter
{
    /** @var array<string, list<string>> */
    public const CONVERSIONS = [
        'offer' => ['confirmation', 'invoice'],
        'confirmation' => ['invoice'],
        'invoice' => ['cancellation'],
        'cancellation' => [],
    ];

    public static function canConvert(DocumentType $source, DocumentStatus $status, bool $alreadyCancelled, DocumentType $target): bool
    {
        if (! in_array($target->value, self::CONVERSIONS[$source->value], true)) {
            return false;
        }
        if ($target === DocumentType::Cancellation) {
            return in_array($status, [DocumentStatus::Open, DocumentStatus::Paid], true) && ! $alreadyCancelled;
        }
        if ($source === DocumentType::Offer) {
            return $status === DocumentStatus::Accepted;
        }

        return $status !== DocumentStatus::Draft;
    }

    /**
     * Custom values move along when their field is defined for the target type too; others are dropped and reported.
     *
     * @param  list<FieldDefinitionData>  $definitions
     *
     * @throws DomainException when the conversion is not allowed
     */
    public static function convert(ConversionSource $source, DocumentType $target, ?int $paymentTermDays, array $definitions, string $today): ConversionPlan
    {
        if (! self::canConvert($source->type, $source->status, $source->alreadyCancelled, $target)) {
            throw new DomainException("Conversion {$source->type->value} ({$source->status->value}) -> {$target->value} is not allowed.");
        }

        $dropped = [];
        $groups = [];
        foreach ($source->groups as $group) {
            $positions = [];
            foreach ($group->positions as $p) {
                if ($p->kind === PositionKind::Optional) {
                    continue;
                }
                $positions[] = new PositionInput(
                    id: $p->id,
                    kind: $p->kind,
                    title: $p->title,
                    quantity: $p->kind === PositionKind::Item && $target === DocumentType::Cancellation ? $p->quantity->negated() : $p->quantity,
                    unitPrice: $p->unitPrice,
                    unitId: $p->unitId,
                    taxRateId: $p->taxRateId,
                    custom: self::pick($p->custom, FieldScope::Position, $target, $definitions, $dropped),
                    description: $p->description,
                );
            }
            if ($positions !== [] || $group->title === null) {
                $groups[] = new GroupInput($group->id, $group->title, $positions);
            }
        }

        return new ConversionPlan(
            groups: $groups,
            custom: self::pick($source->custom, FieldScope::Document, $target, $definitions, $dropped),
            serviceDate: $source->serviceDate ?? ($target === DocumentType::Invoice ? $today : null),
            serviceDateEnd: $source->serviceDateEnd,
            dueDate: $target === DocumentType::Invoice && $paymentTermDays !== null
                ? (new DateTimeImmutable($today))->modify("+{$paymentTermDays} days")->format('Y-m-d')
                : null,
            droppedFields: array_values(array_unique($dropped)),
        );
    }

    /**
     * @param  array<string, mixed>  $custom
     * @param  list<FieldDefinitionData>  $definitions
     * @param  list<string>  $dropped
     * @return array<string, mixed>
     */
    private static function pick(array $custom, FieldScope $scope, DocumentType $target, array $definitions, array &$dropped): array
    {
        $keys = array_map(fn (FieldDefinitionData $d): string => $d->key, FieldRegistry::forScope($definitions, $scope, $target));
        $kept = [];
        foreach ($custom as $key => $value) {
            if (in_array($key, $keys, true)) {
                $kept[$key] = $value;
            } else {
                $dropped[] = "{$scope->value}.{$key}";
            }
        }

        return $kept;
    }
}
