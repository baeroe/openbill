<?php

namespace App\Models;

use App\Enums\DocumentStatus;
use App\Enums\DocumentType;
use App\Exceptions\DocumentLockedException;
use Database\Factories\DocumentFactory;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

/**
 * Offer, order confirmation, invoice or cancellation. From finalized_at on only status, paid_at
 * and cancelled_by_id may change (GoBD); the hooks below enforce that for every model save.
 * Workflows live in app/Actions.
 */
class Document extends Model
{
    /** @use HasFactory<DocumentFactory> */
    use HasFactory, HasUlids;

    /** Columns that may still change after finalizing. */
    public const MUTABLE_WHEN_FINALIZED = ['status', 'paid_at', 'cancelled_by_id', 'updated_at'];

    protected $guarded = ['id'];

    protected static function booted(): void
    {
        static::updating(function (Document $document): void {
            if ($document->getOriginal('finalized_at') === null) {
                return;
            }
            $locked = array_values(array_diff(array_keys($document->getDirty()), self::MUTABLE_WHEN_FINALIZED));
            // finalized_at (not mutable) and status keep the two lock criteria in sync: never back to draft
            if ($document->isDirty('status') && $document->status === DocumentStatus::Draft) {
                $locked[] = 'status';
            }
            if ($locked !== []) {
                throw DocumentLockedException::for($document, $locked);
            }
        });

        static::deleting(function (Document $document): void {
            if ($document->getOriginal('finalized_at') !== null) {
                throw DocumentLockedException::for($document);
            }
        });
    }

    /** Guard for groups and positions: throws when their document is finalized. */
    public static function assertDraft(string $id): void
    {
        $document = static::query()->select(['id', 'number', 'finalized_at'])->find($id);
        if ($document !== null && $document->finalized_at !== null) {
            throw DocumentLockedException::for($document);
        }
    }

    public function isFinalized(): bool
    {
        return $this->finalized_at !== null;
    }

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'type' => DocumentType::class,
            'status' => DocumentStatus::class,
            'date' => 'immutable_date:Y-m-d',
            'service_date' => 'immutable_date:Y-m-d',
            'service_date_end' => 'immutable_date:Y-m-d',
            'due_date' => 'immutable_date:Y-m-d',
            'valid_until' => 'immutable_date:Y-m-d',
            'custom' => 'array',
            'finalized_at' => 'immutable_datetime',
            'paid_at' => 'immutable_datetime',
            'net_total' => 'decimal:2',
            'tax_total' => 'decimal:2',
            'gross_total' => 'decimal:2',
        ];
    }

    /** @return BelongsTo<Customer, $this> */
    public function customer(): BelongsTo
    {
        return $this->belongsTo(Customer::class);
    }

    /** @return BelongsTo<Contact, $this> */
    public function contact(): BelongsTo
    {
        return $this->belongsTo(Contact::class);
    }

    /** @return BelongsTo<Template, $this> */
    public function template(): BelongsTo
    {
        return $this->belongsTo(Template::class);
    }

    /** @return BelongsTo<Document, $this> */
    public function source(): BelongsTo
    {
        return $this->belongsTo(Document::class, 'source_id');
    }

    /**
     * Finalized and draft cancellations of this invoice (partial cancellations: several).
     *
     * @return HasMany<Document, $this>
     */
    public function cancellations(): HasMany
    {
        return $this->hasMany(Document::class, 'source_id')->where('type', DocumentType::Cancellation->value);
    }

    /** @return BelongsTo<Document, $this> */
    public function cancelledBy(): BelongsTo
    {
        return $this->belongsTo(Document::class, 'cancelled_by_id');
    }

    /** @return BelongsTo<User, $this> */
    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    /** @return HasMany<PositionGroup, $this> */
    public function groups(): HasMany
    {
        return $this->hasMany(PositionGroup::class)->orderBy('sort');
    }

    /** @return HasMany<Position, $this> */
    public function positions(): HasMany
    {
        return $this->hasMany(Position::class);
    }

    /** @return HasOne<DocumentSnapshot, $this> */
    public function snapshot(): HasOne
    {
        return $this->hasOne(DocumentSnapshot::class);
    }

    /** @return HasMany<DocumentFile, $this> */
    public function files(): HasMany
    {
        return $this->hasMany(DocumentFile::class);
    }

    /** @return HasMany<DocumentEvent, $this> */
    public function events(): HasMany
    {
        // ULIDs are monotonic, so id breaks ties within the same second
        return $this->hasMany(DocumentEvent::class)->orderBy('created_at')->orderBy('id');
    }
}
