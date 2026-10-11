<?php

namespace App\Models;

use App\Enums\PositionKind;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use LogicException;

class Position extends Model
{
    use HasUlids;

    protected $guarded = ['id'];

    protected static function booted(): void
    {
        static::saving(function (Position $position): void {
            Document::assertDraft($position->document_id);
            // moving out of a document needs that document unlocked too
            if ($position->exists && $position->isDirty('document_id')) {
                Document::assertDraft((string) $position->getOriginal('document_id'));
            }
            // the group decides where a position is rendered: it must belong to the same document
            if (! PositionGroup::query()->whereKey($position->group_id)->where('document_id', $position->document_id)->exists()) {
                throw new LogicException("Position group {$position->group_id} does not belong to document {$position->document_id}.");
            }
        });
        static::deleting(function (Position $position): void {
            Document::assertDraft((string) $position->getOriginal('document_id'));
        });
    }

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'kind' => PositionKind::class,
            'quantity' => 'decimal:4',
            'unit_price' => 'decimal:4',
            'custom' => 'array',
            'sort' => 'integer',
        ];
    }

    /** @return BelongsTo<Document, $this> */
    public function document(): BelongsTo
    {
        return $this->belongsTo(Document::class);
    }

    /** @return BelongsTo<PositionGroup, $this> */
    public function group(): BelongsTo
    {
        return $this->belongsTo(PositionGroup::class, 'group_id');
    }

    /** @return BelongsTo<Unit, $this> */
    public function unit(): BelongsTo
    {
        return $this->belongsTo(Unit::class);
    }

    /** @return BelongsTo<TaxRate, $this> */
    public function taxRate(): BelongsTo
    {
        return $this->belongsTo(TaxRate::class);
    }
}
