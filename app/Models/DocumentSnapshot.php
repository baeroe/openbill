<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use LogicException;

/** Master data at finalize time (shape: App\Support\SnapshotBuilder). Written once, never changed. */
class DocumentSnapshot extends Model
{
    use HasUlids;

    protected $guarded = ['id'];

    protected static function booted(): void
    {
        static::updating(fn () => throw new LogicException('Document snapshots are immutable.'));
        // deleting a draft removes them by cascade (no model event); finalized documents can't be deleted
        static::deleting(fn () => throw new LogicException('Document snapshots are immutable.'));
    }

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return ['data' => 'array'];
    }

    /** @return BelongsTo<Document, $this> */
    public function document(): BelongsTo
    {
        return $this->belongsTo(Document::class);
    }
}
