<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/** title null = loose positions (no heading, no subtotal). */
class PositionGroup extends Model
{
    use HasUlids;

    protected $guarded = ['id'];

    protected static function booted(): void
    {
        static::saving(function (PositionGroup $group): void {
            Document::assertDraft($group->document_id);
            // moving out of a document needs that document unlocked too
            if ($group->exists && $group->isDirty('document_id')) {
                Document::assertDraft((string) $group->getOriginal('document_id'));
            }
        });
        static::deleting(function (PositionGroup $group): void {
            Document::assertDraft((string) $group->getOriginal('document_id'));
        });
    }

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return ['sort' => 'integer'];
    }

    /** @return BelongsTo<Document, $this> */
    public function document(): BelongsTo
    {
        return $this->belongsTo(Document::class);
    }

    /** @return HasMany<Position, $this> */
    public function positions(): HasMany
    {
        return $this->hasMany(Position::class, 'group_id')->orderBy('sort');
    }
}
