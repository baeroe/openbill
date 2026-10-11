<?php

namespace App\Models;

use App\Enums\PositionKind;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Position extends Model
{
    use HasUlids;

    protected $guarded = ['id'];

    protected static function booted(): void
    {
        static::saving(function (Position $position): void {
            Document::assertDraft($position->document_id);
        });
        static::deleting(function (Position $position): void {
            Document::assertDraft($position->document_id);
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
