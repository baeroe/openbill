<?php

namespace App\Models;

use App\Enums\DocumentFileKind;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use LogicException;

/** Archived PDF/XML of a finalized document (written in phase 3). Immutable. */
class DocumentFile extends Model
{
    use HasUlids;

    protected $guarded = ['id'];

    protected static function booted(): void
    {
        static::updating(fn () => throw new LogicException('Document files are immutable.'));
        // deleting a draft removes them by cascade (no model event); finalized documents can't be deleted
        static::deleting(fn () => throw new LogicException('Document files are immutable.'));
    }

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'kind' => DocumentFileKind::class,
            'size' => 'integer',
        ];
    }

    /** @return BelongsTo<Document, $this> */
    public function document(): BelongsTo
    {
        return $this->belongsTo(Document::class);
    }
}
