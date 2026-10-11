<?php

namespace App\Models;

use App\Enums\ActorType;
use App\Enums\EventAction;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use LogicException;

/** Protocol entry; written by App\Support\EventLog, never changed. */
class DocumentEvent extends Model
{
    use HasUlids;

    protected $guarded = ['id'];

    protected static function booted(): void
    {
        static::updating(fn () => throw new LogicException('Document events are immutable.'));
    }

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'actor_type' => ActorType::class,
            'action' => EventAction::class,
            'payload' => 'array',
        ];
    }

    /** @return BelongsTo<Document, $this> */
    public function document(): BelongsTo
    {
        return $this->belongsTo(Document::class);
    }
}
