<?php

namespace App\Support;

use App\Models\Contact;
use App\Models\Customer;
use App\Models\Document;
use App\Models\DocumentSnapshot;
use App\Models\FieldDefinition;
use App\Models\Organization;
use App\Models\Position;
use Illuminate\Database\Eloquent\Model;

/**
 * Every stored image (uploads/… of image fields, logos/… of the organization) that a record or a snapshot still
 * refers to. Values are read as stored JSON, so a path counts wherever it sits (custom fields of any level, field
 * defaults, the frozen master data of finalized documents), also in soft-deleted customers and contacts.
 */
final class ImageReferences
{
    public const PATTERN = '#^(uploads|logos)/[0-9a-z]{26}\.(png|jpg|jpeg|gif|webp|svg)$#';

    /** @var list<array{class-string<Model>, string}> */
    private const SOURCES = [
        [Organization::class, 'custom'],
        [Customer::class, 'custom'],
        [Contact::class, 'custom'],
        [Document::class, 'custom'],
        [Position::class, 'custom'],
        [FieldDefinition::class, 'default_value'],
        [DocumentSnapshot::class, 'data'],
    ];

    public static function isImagePath(string $value): bool
    {
        return preg_match(self::PATTERN, $value) === 1;
    }

    /**
     * @return array<string, true>
     */
    public static function all(): array
    {
        $paths = [];
        foreach (Organization::query()->pluck('logo_path') as $logo) {
            self::collect($logo, $paths);
        }
        foreach (self::SOURCES as [$model, $column]) {
            $rows = $model::query()->withoutGlobalScopes()->toBase()->select(['id', $column])->lazyById(500);
            foreach ($rows as $row) {
                $raw = $row->{$column};
                self::collect(is_string($raw) ? json_decode($raw, true) : $raw, $paths);
            }
        }

        return $paths;
    }

    /**
     * @param  array<string, true>  $paths
     */
    private static function collect(mixed $value, array &$paths): void
    {
        if (is_string($value)) {
            if (self::isImagePath($value)) {
                $paths[$value] = true;
            }

            return;
        }
        if (is_array($value)) {
            foreach ($value as $item) {
                self::collect($item, $paths);
            }
        }
    }
}
